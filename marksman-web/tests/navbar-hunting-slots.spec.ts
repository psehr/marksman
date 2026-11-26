import { expect, test, type Page } from "@playwright/test";
import type { Hunt } from "@marksman/contracts";

const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const bountyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const hunt = (index: number): Hunt => ({ id: `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, "0")}`,
  userId, bountyId, status: "ongoing", startedAt: "2026-01-01T00:00:00.000Z", endedAt: null });
const slots = (page: Page) => page.getByRole("navigation", { name: "Main navigation" }).getByRole("group", { name: "Hunting slots", exact: true });
async function setup(page: Page, count = 0, signedIn = true) {
  const state = { hunts: Array.from({ length: count }, (_, index) => hunt(index)), failure: false, reads: 0 };
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:3100") return route.continue();
    if (url.pathname === "/auth/me") return route.fulfill(signedIn ? { json: {
      identity: { id: userId, osuUserId: 99, username: "A_very_long_fixture_username", coverUrl: null, countryCode: null, countryName: null },
      stats: { bpBalance: 1_000_000 }, createdAt: "2026-01-01T00:00:00.000Z",
    } } : { status: 401, json: {} });
    if (url.pathname === "/auth/access") return route.fulfill({ status: 204 });
    if (url.pathname === "/users/me/hunts") {
      state.reads++;
      return route.fulfill(state.failure ? { status: 500, json: {} } : { json: state.hunts });
    }
    if (url.pathname === "/bounties") return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
    return route.abort();
  });
  return state;
}
for (const count of [0, 1, 2, 3]) {
  test(`${count} used slots render gray stamps and the remaining count`, async ({ page }) => {
    await setup(page, count);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(slots(page).getByRole("status")).toHaveText(`${3 - count} ${count === 2 ? "slot" : "slots"} left`);
    await expect(slots(page).locator('span[style*="target-arrow"]')).toHaveCount(3);
    await expect(slots(page).locator("span.grayscale")).toHaveCount(count);
    const label = await slots(page).getByRole("status").boundingBox();
    const stamps = await slots(page).locator('div[aria-hidden="true"]').boundingBox();
    expect(stamps!.y).toBeGreaterThanOrEqual(label!.y + label!.height);
  });
}
for (const width of [320, 390, 768, 1024, 1280]) {
  test(`slot card fits beside the user card at ${width}px`, async ({ page }) => {
    await setup(page, 1);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    if (width < 768) await nav.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(slots(page).getByRole("status")).toHaveText("2 slots left");
    const slotBox = await slots(page).boundingBox();
    const userBox = await nav.getByRole("link", { name: "Profile", exact: true }).boundingBox();
    expect(slotBox!.x + slotBox!.width).toBeLessThanOrEqual(userBox!.x);
    expect(Math.abs(slotBox!.y - userBox!.y)).toBeLessThan(8);
    if (width >= 768) {
      const wikiBox = await nav.getByRole("link", { name: "Wiki", exact: true }).boundingBox();
      expect(wikiBox!.x + wikiBox!.width).toBeLessThanOrEqual(slotBox!.x);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await nav.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}

test("failed reads show no count and can be retried", async ({ page }) => {
  const state = await setup(page);
  state.failure = true;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(slots(page).getByRole("button", { name: "Hunting slots unavailable. Click to retry.", exact: true })).toBeVisible();
  await expect(slots(page).getByRole("status")).toHaveCount(0);
  state.failure = false;
  state.hunts = [hunt(1)];
  await slots(page).getByRole("button").click();
  await expect(slots(page).getByRole("status")).toHaveText("2 slots left");
});

test("periodic refresh picks up a hunt closed by settlement", async ({ page }) => {
  const state = await setup(page, 3);
  await page.clock.install();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(slots(page).getByRole("status")).toHaveText("0 slots left");
  state.hunts = [];
  await page.clock.fastForward(30_100);
  await expect(slots(page).getByRole("status")).toHaveText("3 slots left");
});

test("signed-out navigation does not read hunting slots", async ({ page }) => {
  const state = await setup(page, 0, false);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Log in with osu!", exact: true })).toBeVisible();
  await expect(slots(page)).toHaveCount(0);
  expect(state.reads).toBe(0);
});
