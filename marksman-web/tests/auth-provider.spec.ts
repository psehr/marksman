import { expect, test, type Page, type Route } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

const user = {
  identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 123, username: "fixture" },
  stats: { bpBalance: 250 }, createdAt: "2026-01-01T00:00:00.000Z",
};
let script: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [resolve(__dirname, "fixtures/auth-provider-harness.tsx")],
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    tsconfig: resolve(__dirname, "../tsconfig.json"),
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_URL": '"http://fixture.test"' },
  });
  script = result.outputFiles[0]!.text;
});
async function mount(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route("http://fixture.test/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script src="/harness.js"></script>' });
    if (path === "/harness.js") return route.fulfill({ contentType: "application/javascript", body: script });
    await handler(route);
  });
  await page.goto("http://fixture.test/");
}
async function state(page: Page, expected: Record<string, unknown>) {
  await expect.poll(async () => JSON.parse(await page.locator("output").innerText())).toMatchObject(expected);
}
const denied = { code: "ALPHA_ACCESS_REQUIRED", error: "Invite only" };

for (const outcome of ["allowed", "denied", "expired", "other403", "server", "network"] as const) {
  test(`access check: ${outcome}`, async ({ page }) => {
    await mount(page, async route => {
      if (route.request().url().endsWith("/auth/me")) return route.fulfill({ json: user });
      expect(route.request().url()).toBe("http://fixture.test/auth/access");
      expect(route.request().method()).toBe("GET");
      if (outcome === "network") return route.abort();
      const status = { allowed: 204, denied: 403, expired: 401, other403: 403, server: 500 }[outcome];
      await route.fulfill(status === 204 ? { status } : { status, json: outcome === "denied" ? denied : { code: "OTHER", error: "failure" } });
    });
    const failed = ["other403", "server", "network"].includes(outcome);
    await state(page, {
      loading: false, alphaAccess: outcome === "allowed" ? "allowed" : outcome === "denied" ? "denied" : "unknown",
      user: outcome === "allowed" || outcome === "denied" ? user : null,
      error: failed ? "Could not check your session. Please try again." : null,
    });
  });
}

test("signed-out bootstrap skips access check", async ({ page }) => {
  let calls = 0;
  await mount(page, async route => {
    calls++;
    expect(route.request().url()).toBe("http://fixture.test/auth/me");
    await route.fulfill({ status: 401, json: { code: "NOT_LOGGED_IN" } });
  });
  await state(page, { user: null, alphaAccess: "unknown", loading: false, error: null });
  expect(calls).toBe(1);
});

test("loading spans both requests and retry resets access and recovers", async ({ page }) => {
  let access: Route | undefined;
  await mount(page, async route => {
    if (route.request().url().endsWith("/auth/me")) await route.fulfill({ json: user });
    else access = route;
  });
  await expect.poll(() => !!access).toBe(true);
  await state(page, { loading: true, alphaAccess: "unknown" });
  await access!.fulfill({ status: 403, json: denied });
  await state(page, { loading: false, alphaAccess: "denied" });
  access = undefined;
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect.poll(() => !!access).toBe(true);
  await state(page, { loading: true, alphaAccess: "unknown", error: null });
  await access!.fulfill({ status: 204 });
  await state(page, { loading: false, alphaAccess: "allowed", user });
});

for (const stage of ["me", "access"] as const) {
  for (const stale of ["success", "failure"] as const) {
    test(`stale ${stage} ${stale} cannot overwrite newer signed-out refresh`, async ({ page }) => {
      let pending: Route | undefined;
      let newer = false;
      await mount(page, async route => {
        if (newer) return route.fulfill({ status: 401, json: { code: "NOT_LOGGED_IN" } });
        if (route.request().url().endsWith(`/auth/${stage}`)) pending = route;
        else await route.fulfill({ json: user });
      });
      await expect.poll(() => !!pending).toBe(true);
      newer = true;
      await page.getByRole("button", { name: "Refresh" }).click();
      await state(page, { loading: false, user: null, alphaAccess: "unknown" });
      if (stale === "failure") await pending!.fulfill({ status: 403, json: denied });
      else await pending!.fulfill(stage === "me" ? { json: user } : { status: 204 });
      // Flush the released response through the real provider before asserting.
      await page.waitForTimeout(100);
      await state(page, { loading: false, user: null, alphaAccess: "unknown", error: null });
    });
  }
}

test("stale finally cannot clear loading while newer request is pending", async ({ page }) => {
  const requests: Route[] = [];
  await mount(page, async route => { requests.push(route); });
  await expect.poll(() => requests.length).toBe(1);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect.poll(() => requests.length).toBe(2);
  await requests[0]!.fulfill({ status: 401, json: {} });
  await page.waitForTimeout(100);
  await state(page, { loading: true, alphaAccess: "unknown" });
  await requests[1]!.fulfill({ status: 401, json: {} });
  await state(page, { loading: false, user: null });
});

test("cleanup invalidates pending bootstrap before it can request access", async ({ page }) => {
  let pending: Route | undefined;
  let accessCalls = 0;
  await mount(page, async route => {
    if (route.request().url().endsWith("/auth/me")) pending = route;
    else { accessCalls++; await route.fulfill({ status: 204 }); }
  });
  await expect.poll(() => !!pending).toBe(true);
  await page.evaluate(() => (window as unknown as { unmount: () => void }).unmount());
  await expect(page.locator("output")).toHaveCount(0);
  await pending!.fulfill({ json: user });
  await page.waitForTimeout(100);
  expect(accessCalls).toBe(0);
});

test("a failed refresh clears previously allowed access and can be retried", async ({ page }) => {
  let fail = false;
  await mount(page, async route => {
    if (fail) return route.abort();
    await route.fulfill(route.request().url().endsWith("/auth/me") ? { json: user } : { status: 204 });
  });
  await state(page, { loading: false, alphaAccess: "allowed" });
  fail = true;
  await page.getByRole("button", { name: "Refresh" }).click();
  await state(page, { loading: false, alphaAccess: "unknown", user: null, error: "Could not check your session. Please try again." });
  fail = false;
  await page.getByRole("button", { name: "Refresh" }).click();
  await state(page, { loading: false, alphaAccess: "allowed", user, error: null });
});
