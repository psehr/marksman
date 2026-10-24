import { expect, test, type Page, type Route } from "@playwright/test";
import type { ExtendedBounty } from "@marksman/contracts";

const bounty: ExtendedBounty = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "open", rewardBp: 100, creatorOsuUserId: 123,
  createdAt: "2026-01-01T00:00:00.000Z", completedAt: null,
  cancelledAt: null, completedByOsuUserId: null, completionScoreId: null,
  goal: { type: "minimum_grade", beatmapId: 42, beatmapChecksum: null,
    minimumGradeRequirement: "A", modRequirement: { rule: "any" } },
  beatmap: null, owner: null, winner: null,
  engagement: { bookmarkCount: 0, isBookmarkedByCurrentUser: null },
};

async function setup(page: Page, respond: (route: Route, count: number) => Promise<void>) {
  let reads = 0;
  // Freeze browser time so polling tests do not depend on wall-clock delays.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: {} }));
  await page.route(`**/bounties/${bounty.id}`, route => {
    if (route.request().isNavigationRequest()) return route.fallback();
    return respond(route, ++reads);
  });
  await page.goto(`/bounties/${bounty.id}`);
  return () => reads;
}

const open = (page: Page) => page.getByText("OPEN", { exact: true });
const error = (page: Page) => page.getByText("Could not load bounty", { exact: true });

for (const failure of ["network", "http"] as const) {
  test(`initial ${failure} failure retries and recovers`, async ({ page }) => {
    const reads = await setup(page, async (route, count) => {
      if (count === 1) {
        if (failure === "network") return route.abort("failed");
        return route.fulfill({ status: 503, json: { error: "Unavailable" } });
      }
      return route.fulfill({ json: bounty });
    });
    await expect(error(page)).toBeVisible();
    await page.clock.runFor(4999);
    expect(reads()).toBe(1);
    await page.clock.runFor(1);
    await expect(open(page)).toBeVisible();
    await expect(error(page)).toHaveCount(0);
    expect(reads()).toBe(2);
  });

  test(`background ${failure} failure keeps content and recovers`, async ({ page }) => {
    const reads = await setup(page, async (route, count) => {
      if (count === 2) {
        if (failure === "network") return route.abort("failed");
        return route.fulfill({ status: 503, json: { error: "Unavailable" } });
      }
      return route.fulfill({ json: { ...bounty, engagement: {
        ...bounty.engagement, bookmarkCount: count === 1 ? 0 : 7,
      } } });
    });
    await expect(open(page)).toBeVisible();
    await page.clock.runFor(5000);
    await expect.poll(reads).toBe(2);
    // A browser task barrier lets fetch rejection/catch finish before advancing time.
    await page.evaluate(() => new Promise<void>(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    }));
    await expect(open(page)).toBeVisible();
    await expect(error(page)).toHaveCount(0);
    await page.clock.runFor(5000);
    await expect(page.getByText("7 player(s) bookmarked")).toBeVisible();
    expect(reads()).toBe(3);
  });
}

for (const status of ["completed", "cancelled"] as const) {
  test(`polling stops after ${status}`, async ({ page }) => {
    const reads = await setup(page, (route, count) => route.fulfill({
      json: { ...bounty, status: count === 1 ? "open" : status },
    }));
    await expect(open(page)).toBeVisible();
    await page.clock.runFor(5000);
    await expect(page.getByText(status.toUpperCase(), { exact: true })).toBeVisible();
    await page.clock.runFor(20000);
    expect(reads()).toBe(2);
  });
}

test("404 stops retries", async ({ page }) => {
  const reads = await setup(page, route => route.fulfill({ status: 404, json: { error: "Missing" } }));
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await page.clock.runFor(20000);
  expect(reads()).toBe(1);
});

test("navigation away clears scheduled polling", async ({ page }) => {
  const reads = await setup(page, route => route.fulfill({ json: bounty }));
  await expect(open(page)).toBeVisible();
  await page.getByRole("link", { name: "Marksman", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.clock.runFor(20000);
  expect(reads()).toBe(1);
});

test("slow request does not overlap and its late response cannot restart polling after navigation", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const reads = await setup(page, async (route, count) => {
    if (count === 2) await gate;
    await route.fulfill({ json: bounty });
  });
  await expect(open(page)).toBeVisible();
  await page.clock.runFor(5000);
  await expect.poll(reads).toBe(2);
  await page.clock.runFor(20000);
  expect(reads()).toBe(2);
  await page.getByRole("link", { name: "Marksman", exact: true }).click();
  await expect(page).toHaveURL("/");
  release();
  await page.clock.runFor(20000);
  await expect(open(page)).toHaveCount(0);
  expect(reads()).toBe(2);
});
