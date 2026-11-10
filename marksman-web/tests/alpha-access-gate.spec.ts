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
