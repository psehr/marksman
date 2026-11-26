import { expect, test, type Page } from "@playwright/test";
import type { ExtendedBounty, Hunt } from "@marksman/contracts";
import { linkedBeatmap } from "./fixtures/beatmap-links";

const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const bounty: ExtendedBounty = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "open", rewardBp: 300, creatorOsuUserId: 42,
  createdAt: "2026-01-01T00:00:00.000Z", completedAt: null, cancelledAt: null,
  completedByOsuUserId: null, completionScoreId: null,
  goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { required: [], forbidden: [], allowOtherMods: true } },
  beatmap: linkedBeatmap, owner: null, winner: null,
  engagement: { hunterCount: 0, bookmarkCount: 0, isBookmarkedByCurrentUser: false },
};
const hunt: Hunt = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", userId, bountyId: bounty.id,
  status: "ongoing", startedAt: "2026-01-01T00:00:00.000Z", endedAt: null };
async function setup(page: Page, overrides: Partial<ExtendedBounty> = {}) {
  const state = {
    bounty: { ...bounty, ...overrides }, hunts: [] as Hunt[], huntReads: 0,
    posts: [] as string[], failRead: false, failHunt: false, failBookmark: false,
    extraCards: false, holdPosts: null as Promise<void> | null, loseHuntResponse: false, listReads: 0, profileHuntReads: 0,
  };
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:3100") return route.continue();
    if (url.pathname === "/auth/me") return route.fulfill({ json: {
      identity: { id: userId, osuUserId: 99, username: "fixture", coverUrl: null, countryCode: null, countryName: null },
      stats: { bpBalance: 1000 }, createdAt: "2026-01-01T00:00:00.000Z",
    } });
    if (url.pathname === "/auth/access") return route.fulfill({ status: 204 });
    if (url.pathname === `/users/${userId}`) return route.fulfill({ json: {
      identity: { id: userId, osuUserId: 99, username: "fixture", coverUrl: null, countryCode: null, countryName: null },
      stats: { bpBalance: 1000, bountiesWon: 0, bountyEarningsBp: 0 }, createdAt: "2026-01-01T00:00:00.000Z",
    } });
    if (url.pathname === `/users/${userId}/hunts`) {
      state.profileHuntReads++;
      return route.fulfill({ json: state.hunts.map(hunt => ({ hunt, bounty: state.bounty })) });
    }
    if (url.pathname.endsWith("/bounty-events") || url.pathname === "/users/me/ledger") return route.fulfill({ json: [] });
    if (request.method() === "POST") {
      state.posts.push(url.pathname);
      if (state.holdPosts) await state.holdPosts;
      if (url.pathname.endsWith("/bookmark") || url.pathname.endsWith("/unbookmark")) {
        if (state.failBookmark) return route.fulfill({ status: 409, json: { code: "CONFLICT", error: "Bookmark unavailable" } });
        state.bounty = { ...state.bounty, engagement: { ...state.bounty.engagement,
          isBookmarkedByCurrentUser: url.pathname.endsWith("/bookmark") } };
        return route.fulfill({ status: 204 });
      }
      if (url.pathname.endsWith("/hunt") || url.pathname.endsWith("/stop")) {
        if (state.failHunt) return route.fulfill({ status: 409, json: { code: "LIMIT", error: "All hunting slots are occupied" } });
        const stopped = url.pathname.endsWith("/stop");
        state.hunts = stopped ? [] : [hunt];
        state.bounty = { ...state.bounty, engagement: { ...state.bounty.engagement, hunterCount: stopped ? 0 : 1 } };
        if (state.loseHuntResponse) { state.loseHuntResponse = false; return route.abort(); }
        return route.fulfill({ json: stopped ? { ...hunt, status: "stopped", endedAt: "2026-01-02T00:00:00.000Z" } : hunt });
      }
      return route.abort();
    }
    if (url.pathname === "/users/me/hunts") {
      state.huntReads++;
      return route.fulfill({ json: state.hunts });
    }
    if (url.pathname === "/bounties") {
      state.listReads++;
      const relationship = url.searchParams.get("relationship");
      const excluded = url.searchParams.has("creatorId") || url.searchParams.has("winnerId") ||
        (relationship === "bookmarked" && !state.bounty.engagement.isBookmarkedByCurrentUser) ||
        (relationship === "hunting" && !state.hunts.length);
      const items = excluded ? [] : state.extraCards
        ? [state.bounty, { ...state.bounty, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }] : [state.bounty];
      return route.fulfill({ json: { items, total: items.length, page: 1, pageSize: 20 } });
    }
    if (url.pathname === `/bounties/${bounty.id}`) return state.failRead
      ? route.fulfill({ status: 500, json: { code: "ERROR", error: "Read failed" } })
      : route.fulfill({ json: state.bounty });
    return route.abort();
  });
  return state;
}

test("card toggles bookmarks and hunts without navigating", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/bounties");
  await page.getByRole("button", { name: "Bookmark bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove bounty bookmark", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Remove bounty bookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bookmark bounty", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Start hunting bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop hunting bounty", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Hunting slots", exact: true }).getByRole("status")).toHaveText("2 slots left");
  await expect(page.getByText("1 ongoing hunter", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Stop hunting bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start hunting bounty", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("group", { name: "Hunting slots", exact: true }).getByRole("status")).toHaveText("3 slots left");
  expect(state.posts).toEqual([`/bounties/${bounty.id}/bookmark`, `/bounties/${bounty.id}/unbookmark`, `/bounties/${bounty.id}/hunt`, `/hunts/${hunt.id}/stop`]);
  await expect(page).toHaveURL(/\/bounties$/);
  await page.locator(`a[href="/bounties/${bounty.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/bounties/${bounty.id}$`));
});

test("saved bookmark retries only reads after refresh failure", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/bounties");
  state.failRead = true;
  await page.getByRole("button", { name: "Bookmark bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry bookmark refresh", exact: true })).toBeVisible();
  state.failRead = false;
  await page.getByRole("button", { name: "Retry bookmark refresh", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove bounty bookmark", exact: true })).toBeEnabled();
  expect(state.posts).toHaveLength(1);
});

test("slot-limit failure offers reload before retrying", async ({ page }) => {
  const state = await setup(page);
  state.failHunt = true;
  await page.goto("/bounties");
  await page.getByRole("button", { name: "Start hunting bounty", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "All hunting slots are occupied" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload bounty hunts", exact: true })).toBeVisible();
  state.failHunt = false;
  await page.getByRole("button", { name: "Reload bounty hunts", exact: true }).click();
  await page.getByRole("button", { name: "Start hunting bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop hunting bounty", exact: true })).toBeVisible();
});

test("card and detail controls stay synchronized", async ({ page }) => {
  await setup(page);
  await page.goto(`/bounties/${bounty.id}`);
  await page.getByRole("button", { name: "Start hunting bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop Hunting", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop Hunting", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start hunting bounty", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bookmark bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unbookmark", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unbookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bookmark bounty", exact: true })).toBeVisible();
});

test("cards share their initial hunt read", async ({ page }) => {
  const state = await setup(page);
  state.extraCards = true;
  await page.goto("/bounties");
  await expect(page.getByRole("button", { name: "Start hunting bounty", exact: true })).toHaveCount(2);
  // One independent navbar read; both cards still share their own initial read.
  expect(state.huntReads).toBe(2);
});

for (const variant of ["owner", "completed", "cancelled"] as const) {
  test(`${variant} cards hide unavailable actions`, async ({ page }) => {
    await setup(page, variant === "owner" ? { creatorOsuUserId: 99 } : { status: variant });
    await page.goto("/bounties");
    await expect(page.locator(`a[href="/bounties/${bounty.id}"]`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start hunting bounty", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bookmark bounty", exact: true })).toHaveCount(0);
  });
}

for (const width of [320, 390, 1280]) {
  test(`card controls fit and work by keyboard at ${width}px`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/bounties");
    const button = page.getByRole("button", { name: "Bookmark bounty", exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Remove bounty bookmark", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await button.count()).toBe(0);
  });
}

test("duplicate hunt controls share their pending lock while bookmarking stays independent", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByRole("button", { name: "Start hunting bounty", exact: true })).toBeEnabled();
  let release = () => {};
  state.holdPosts = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.getByRole("button", { name: "Start hunting bounty", exact: true }).click();
    const card = page.getByRole("button", { name: "Updating hunt...", exact: true });
    const detail = page.getByRole("button", { name: "Starting...", exact: true });
    await expect(card).toBeDisabled();
    await expect(detail).toBeDisabled();
    await expect(page.getByRole("button", { name: "Bookmark bounty", exact: true })).toBeEnabled();
    await card.dispatchEvent("click");
    await detail.dispatchEvent("click");
    expect(state.posts).toEqual([`/bounties/${bounty.id}/hunt`]);
  } finally { release(); }
  await expect(page.getByRole("button", { name: "Stop hunting bounty", exact: true })).toBeEnabled();
});

test("rejected bookmark preserves its state and can be retried", async ({ page }) => {
  const state = await setup(page);
  state.failBookmark = true;
  await page.goto("/bounties");
  await page.getByRole("button", { name: "Bookmark bounty", exact: true }).click();
  await expect(page.getByText("Bookmark unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bookmark bounty", exact: true })).toHaveAttribute("aria-pressed", "false");
  state.failBookmark = false;
  await page.getByRole("button", { name: "Bookmark bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove bounty bookmark", exact: true })).toBeEnabled();
});

test("closed bookmarked bounty still allows removing its bookmark", async ({ page }) => {
  await setup(page, { status: "completed", engagement: { hunterCount: 0, bookmarkCount: 1, isBookmarkedByCurrentUser: true } });
  await page.goto("/bounties");
  await page.getByRole("button", { name: "Remove bounty bookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove bounty bookmark", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bookmark bounty", exact: true })).toHaveCount(0);
});

test("lost hunt response reloads authoritative state without starting twice", async ({ page }) => {
  const state = await setup(page);
  state.loseHuntResponse = true;
  await page.goto("/bounties");
  await page.getByRole("button", { name: "Start hunting bounty", exact: true }).click();
  await page.getByRole("button", { name: "Reload bounty hunts", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop hunting bounty", exact: true })).toBeEnabled();
  expect(state.posts).toEqual([`/bounties/${bounty.id}/hunt`]);
});

test("hunt and bookmark errors remain readable together", async ({ page }) => {
  const state = await setup(page);
  state.failHunt = true;
  state.failBookmark = true;
  await page.goto("/bounties");
  await page.getByRole("button", { name: "Start hunting bounty", exact: true }).click();
  await expect(page.getByText("All hunting slots are occupied", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bookmark bounty", exact: true }).click();
  await expect(page.getByText("Bookmark unavailable", { exact: true })).toBeVisible();
  const huntError = await page.getByText("All hunting slots are occupied", { exact: true }).boundingBox();
  const bookmarkError = await page.getByText("Bookmark unavailable", { exact: true }).boundingBox();
  expect(bookmarkError!.y).toBeGreaterThanOrEqual(huntError!.y + huntError!.height);
});

test("bookmark pending state is shared with detail controls", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByRole("button", { name: "Bookmark bounty", exact: true })).toBeEnabled();
  let release = () => {};
  state.holdPosts = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.getByRole("button", { name: "Bookmark bounty", exact: true }).click();
    const card = page.getByRole("button", { name: "Saving bounty bookmark...", exact: true });
    const detail = page.getByRole("button", { name: "Saving...", exact: true });
    await expect(card).toBeDisabled();
    await expect(detail).toBeDisabled();
    await card.dispatchEvent("click");
    await detail.dispatchEvent("click");
    expect(state.posts).toEqual([`/bounties/${bounty.id}/bookmark`]);
  } finally { release(); }
  await expect(page.getByRole("button", { name: "Remove bounty bookmark", exact: true })).toBeEnabled();
});

for (const relationship of ["hunting", "bookmarked"]) {
  test(`${relationship} board updates membership after a card action`, async ({ page }) => {
    const state = await setup(page, { engagement: { hunterCount: 1, bookmarkCount: 1, isBookmarkedByCurrentUser: true } });
    state.hunts = [hunt];
    await page.goto(`/bounties?relationship=${relationship}`);
    await page.getByRole("button", { name: relationship === "hunting" ? "Stop hunting bounty" : "Remove bounty bookmark", exact: true }).click();
    await expect.poll(() => state.listReads).toBeGreaterThan(1);
    await expect(page.locator(`a[href="/bounties/${bounty.id}"]`)).toHaveCount(0);
  });
}

test("stopping a hunt from a profile slot refreshes the slot", async ({ page }) => {
  const state = await setup(page);
  state.hunts = [hunt];
  await page.goto(`/users/${userId}`);
  await page.getByRole("button", { name: "Stop hunting bounty", exact: true }).click();
  await expect.poll(() => state.profileHuntReads).toBeGreaterThan(1);
  await expect(page.locator(`a[href="/bounties/${bounty.id}"]`)).toHaveCount(0);
});
