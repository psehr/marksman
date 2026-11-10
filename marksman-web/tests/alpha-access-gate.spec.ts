import { expect, test, type Page, type Route } from "@playwright/test";

const user = {
  identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 123, username: "alpha_fixture" },
  stats: { bpBalance: 250 }, createdAt: "2026-01-01T00:00:00.000Z",
};
async function mockAuth(page: Page, handler: (route: Route, path: string) => Promise<void>) {
  await page.route("**/auth/**", async route => handler(route, new URL(route.request().url()).pathname));
}
async function noProtectedContent(page: Page) {
  await expect(page.getByRole("link", { name: "Browse bounties", exact: true })).toHaveCount(0);
  await expect(page.getByText("Create and complete osu! bounties.", { exact: true })).toHaveCount(0);
}

test("pending session and access checks show only loading feedback", async ({ page }) => {
  let pending: Route | undefined;
  await mockAuth(page, async route => { pending = route; });
  await page.goto("/");
  await expect.poll(() => !!pending).toBe(true);
  await expect(page.getByText("Loading...", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Authentication", exact: true })).toHaveCount(0);
  await noProtectedContent(page);
  const me = pending!;
  pending = undefined;
  await me.fulfill({ json: user });
  await expect.poll(() => !!pending).toBe(true);
  await expect(page.getByText("Loading...", { exact: true })).toBeVisible();
  await noProtectedContent(page);
  await pending!.fulfill({ status: 204 });
  await expect(page.getByText("Loading...", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Authentication", exact: true })).toHaveCount(0);
});

test("signed-out direct protected URL shows login and hides page content", async ({ page }) => {
  await mockAuth(page, async route => { await route.fulfill({ status: 401, json: { code: "NOT_LOGGED_IN" } }); });
  await page.route("**/bounties?**", route => route.abort());
  await page.goto("/bounties/creation-tool");
  await expect(page.getByRole("heading", { name: "Authentication", exact: true })).toBeVisible();
  const login = page.getByRole("link", { name: "Log in with osu!" });
  await expect(login.first()).toBeVisible();
  await expect(login.first()).toHaveAttribute("href", /\/auth\/osu$/);
  await expect(page.getByText("Unknown alpha-access status.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Error", exact: true })).toHaveCount(0);
});

for (const failure of ["network", "server", "other403"] as const) {
  test(`${failure} access failure shows one retry panel and recovers`, async ({ page }) => {
    let attempts = 0;
    await mockAuth(page, async (route, path) => {
      if (path === "/auth/me") return route.fulfill({ json: user });
      expect(path).toBe("/auth/access");
      if (++attempts > 1) return route.fulfill({ status: 204 });
      if (failure === "network") return route.abort();
      await route.fulfill({ status: failure === "server" ? 500 : 403, json: { code: "OTHER", error: "fixture failure" } });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Error", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Authentication", exact: true })).toHaveCount(0);
    await expect(page.getByText("Unknown alpha-access status.")).toHaveCount(0);
    await noProtectedContent(page);
    await page.getByRole("button", { name: "Try again" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Error", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Browse/ }).last()).toBeVisible();
    expect(attempts).toBe(2);
  });
}

test("denied user can log out and failed logout remains retryable", async ({ page }) => {
  let signedIn = true;
  let logoutAttempts = 0;
  await mockAuth(page, async (route, path) => {
    if (path === "/auth/me") return route.fulfill(signedIn ? { json: user } : { status: 401, json: { code: "NOT_LOGGED_IN" } });
    if (path === "/auth/access") return route.fulfill({ status: 403, json: { code: "ALPHA_ACCESS_REQUIRED" } });
    expect(path).toBe("/auth/logout");
    expect(route.request().method()).toBe("POST");
    if (++logoutAttempts === 1) return route.fulfill({ status: 500, json: {} });
    signedIn = false;
    await route.fulfill({ status: 204 });
  });
  await page.goto("/");
  const panel = page.getByRole("heading", { name: "Alpha access denied" }).locator("..");
  await expect(panel).toBeVisible();
  await noProtectedContent(page);
  await panel.getByRole("button", { name: "Log out" }).click();
  await expect(panel.getByRole("alert")).toContainText("Could not log out");
  await panel.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Authentication", exact: true })).toBeVisible();
  await expect(panel).toHaveCount(0);
});

for (const width of [320, 375, 390, 1280]) {
  for (const mode of ["signedOut", "denied", "error"] as const) {
    test(`${mode} feedback fits and centers at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockAuth(page, async (route, path) => {
        if (path === "/auth/me") return route.fulfill(mode === "signedOut" ? { status: 401, json: {} } : { json: user });
        await route.fulfill({ status: mode === "denied" ? 403 : 500, json: { code: mode === "denied" ? "ALPHA_ACCESS_REQUIRED" : "OTHER" } });
      });
      await page.goto("/");
      const title = mode === "signedOut" ? "Authentication" : mode === "denied" ? "Alpha access denied" : "Error";
      const panel = page.getByRole("heading", { name: title, exact: true }).locator("..");
      await expect(panel).toBeVisible();
      const dimensions = await panel.evaluate(element => {
        const panel = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          horizontal: Math.abs((panel.left + panel.right) / 2 - (parent.left + parent.right) / 2),
          vertical: Math.abs((panel.top + panel.bottom) / 2 - (parent.top + parent.bottom) / 2),
          fits: panel.left >= 0 && panel.right <= innerWidth,
        };
      });
      expect(dimensions).toMatchObject({ overflow: false, fits: true });
      expect(dimensions.horizontal).toBeLessThanOrEqual(1);
      expect(dimensions.vertical).toBeLessThanOrEqual(1);
    });
  }
}


test("allowed page retains full content width outside the feedback wrapper", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockAuth(page, async (route, path) => {
    await route.fulfill(path === "/auth/me" ? { json: user } : { status: 204 });
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Browse bounties", exact: true })).toBeVisible();
  const main = page.locator("main");
  const dimensions = await main.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    parentClasses: element.parentElement!.className,
  }));
  expect(dimensions.width).toBe(1280);
  expect(dimensions.parentClasses).not.toContain("justify-center");
  await expect(page.getByRole("heading", { name: "Authentication", exact: true })).toHaveCount(0);
});

test("login and logout icons are decorative and preserve accessible labels", async ({ page }) => {
  let signedIn = false;
  await mockAuth(page, async (route, path) => {
    if (path === "/auth/me") return route.fulfill(signedIn ? { json: user } : { status: 401, json: {} });
    if (path === "/auth/access") return route.fulfill({ status: 403, json: { code: "ALPHA_ACCESS_REQUIRED" } });
    expect(path).toBe("/auth/logout");
    signedIn = false;
    await route.fulfill({ status: 204 });
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  const panel = page.getByRole("heading", { name: "Authentication", exact: true }).locator("..");
  const login = panel.getByRole("link", { name: "Log in with osu!", exact: true });
  await expect(login).toBeVisible();
  await expect(login.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(login.locator("svg")).toHaveAttribute("focusable", "false");
  await login.focus();
  await expect(login).toBeFocused();
  signedIn = true;
  await page.reload();
  const denied = page.getByRole("heading", { name: "Alpha access denied", exact: true }).locator("..");
  const logout = denied.getByRole("button", { name: "Log out", exact: true });
  await expect(logout.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await logout.focus();
  await page.keyboard.press("Enter");
  await expect(login).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [320, 640, 1280]) {
  test(`browse/create icons preserve labels, destinations and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAuth(page, async (route, path) => {
      await route.fulfill(path === "/auth/me" ? { json: user } : { status: 204 });
    });
    await page.route(/\/bounties(?:\?.*)?$/, async route => {
      if (new URL(route.request().url()).origin === "http://127.0.0.1:3100") return route.fallback();
      await route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
    });
    await page.goto("/");
    const browse = page.getByRole("link", { name: "Browse bounties", exact: true });
    const create = page.getByRole("link", { name: "Create a bounty", exact: true });
    await expect(browse).toHaveAttribute("href", "/bounties");
    await expect(create).toHaveAttribute("href", "/bounties/creation-tool");
    for (const action of [browse, create]) {
      await expect(action.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(action.locator("svg")).toHaveAttribute("focusable", "false");
      await action.focus();
      await expect(action).toBeFocused();
      expect(await action.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await browse.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/bounties$/);
    await expect(create).toBeVisible();
    await expect(create.locator("svg")).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [320, 640, 1280]) {
  test(`About navigation icons preserve names, targets and fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAuth(page, async (route, path) => {
      await route.fulfill(path === "/auth/me" ? { json: user } : { status: 204 });
    });
    await page.route(/\/bounties(?:\?.*)?$/, async route => {
      if (new URL(route.request().url()).origin === "http://127.0.0.1:3100") return route.fallback();
      await route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
    });
    async function check(name: string, href: string) {
      const action = page.getByRole("link", { name, exact: true });
      await expect(action).toHaveAttribute("href", href);
      await expect(action.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(action.locator("svg")).toHaveAttribute("focusable", "false");
      expect(await action.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      return action;
    }
    await page.goto("/");
    const help = await check("How does it work?", "/about");
    await help.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/about$/);
    for (const [name, href] of [
      ["About - Bounties", "/about/bounties"],
      ["About - Bounty Creation", "/about/bounty-creation"],
      ["About - Hunting", "/about/hunting"],
      ["About - Economy", "/about/economy"],
    ]) await check(name, href);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/bounties");
    const learn = await check("Learn about bounties", "/about/bounties");
    await learn.click();
    await expect(page).toHaveURL(/\/about\/bounties$/);
  });
}
