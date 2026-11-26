import { expect, test, type Page } from "@playwright/test";
import type { ExtendedBounty } from "@marksman/contracts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bounty: ExtendedBounty = {
  id, status: "open", rewardBp: 300, creatorOsuUserId: 42,
  createdAt: "2026-01-01T00:00:00.000Z", completedAt: null, cancelledAt: null,
  completedByOsuUserId: null, completionScoreId: null,
  goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { required: [], forbidden: [], allowOtherMods: true } },
  beatmap: null, owner: null, winner: null,
  engagement: { hunterCount: 0, bookmarkCount: 0, isBookmarkedByCurrentUser: false },
};
async function setup(page: Page, owner = true, closed = false) {
  const state = { posts: 0, fail: false, hold: null as Promise<void> | null,
    bounty: { ...bounty, status: closed ? "cancelled" : "open" } as ExtendedBounty };
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:3100") return route.continue();
    if (url.pathname === "/auth/me") return route.fulfill({ json: {
      identity: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", osuUserId: owner ? 42 : 99, username: "fixture", coverUrl: null, countryCode: null, countryName: null },
      stats: { bpBalance: 1000 }, createdAt: "2026-01-01T00:00:00.000Z",
    } });
    if (url.pathname === "/auth/access") return route.fulfill({ status: 204 });
    if (url.pathname === "/users/me/hunts") return route.fulfill({ json: [] });
    if (url.pathname === `/bounties/${id}/cancel`) {
      state.posts++;
      if (state.hold) await state.hold;
      if (state.fail) return route.fulfill({ status: 409, json: { code: "CONFLICT", error: "Cancellation rejected" } });
      state.bounty = { ...state.bounty, status: "cancelled", cancelledAt: "2026-01-02T00:00:00.000Z" };
      return route.fulfill({ json: { bounty: state.bounty } });
    }
    if (url.pathname === `/bounties/${id}`) return route.fulfill({ json: state.bounty });
    return route.abort();
  });
  return state;
}
const panel = (page: Page) => page.getByRole("group", { name: "Confirm bounty cancellation", exact: true });

test("opening, keeping and Escape never submit cancellation", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/bounties/${id}`);
  const trigger = page.getByRole("button", { name: "Cancel bounty", exact: true });
  await trigger.click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toContainText("Fees will not be refunded.");
  await expect(page.getByRole("button", { name: "Keep bounty", exact: true })).toBeFocused();
  expect(state.posts).toBe(0);
  await page.getByRole("button", { name: "Keep bounty", exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(state.posts).toBe(0);
});

test("confirm submits once and locks both choices until it finishes", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/bounties/${id}`);
  await page.getByRole("button", { name: "Cancel bounty", exact: true }).click();
  let release = () => {};
  state.hold = new Promise<void>(resolve => { release = resolve; });
  try {
    await panel(page).getByRole("button", { name: "Confirm cancellation", exact: true }).click();
    const pending = panel(page).getByRole("button", { name: "Cancelling...", exact: true });
    await expect(pending).toBeDisabled();
    await expect(panel(page).getByRole("button", { name: "Keep bounty", exact: true })).toBeDisabled();
    await pending.dispatchEvent("click");
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeVisible();
    expect(state.posts).toBe(1);
  } finally { release(); }
  await expect(page.getByText("This bounty has been cancelled by its creator.", { exact: true })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
});

test("failed cancellation keeps confirmation available for retry or dismissal", async ({ page }) => {
  const state = await setup(page);
  state.fail = true;
  await page.goto(`/bounties/${id}`);
  await page.getByRole("button", { name: "Cancel bounty", exact: true }).click();
  await panel(page).getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByText("Cancellation rejected", { exact: true })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Confirm cancellation", exact: true })).toBeEnabled();
  state.fail = false;
  await panel(page).getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByText("This bounty has been cancelled by its creator.", { exact: true })).toBeVisible();
  expect(state.posts).toBe(2);
});

for (const variant of ["viewer", "closed"] as const) {
  test(`${variant} cannot open cancellation confirmation`, async ({ page }) => {
    const state = await setup(page, variant !== "viewer", variant === "closed");
    await page.goto(`/bounties/${id}`);
    await expect(page.locator(`a[href="/bounties/${id}"]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel bounty", exact: true })).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);
    expect(state.posts).toBe(0);
  });
}

for (const width of [320, 390, 1280]) {
  test(`confirmation fits and supports keyboard dismissal at ${width}px`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/bounties/${id}`);
    const trigger = page.getByRole("button", { name: "Cancel bounty", exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}
