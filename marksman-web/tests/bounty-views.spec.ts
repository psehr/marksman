import { expect, test, type Page } from "@playwright/test";
import type { ExtendedBounty } from "@marksman/contracts";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bounty: ExtendedBounty = {
  id, status: "open", rewardBp: 300, creatorOsuUserId: 42,
  createdAt: "2026-01-01T00:00:00.000Z", completedAt: null, cancelledAt: null,
  completedByOsuUserId: null, completionScoreId: null,
  goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { rule: "any" } },
  beatmap: null, owner: null, winner: null,
  engagement: { bookmarkCount: 3, isBookmarkedByCurrentUser: false },
};
async function setup(page: Page, overrides: Partial<ExtendedBounty> = {}) {
  const state = { hunts: 0, reads: 0, posts: 0, bounty: { ...bounty, ...overrides } };
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === "http://127.0.0.1:3100") return route.continue();
    if (req.method() === "POST") { state.posts++; return route.abort(); }
    if (url.pathname === "/auth/me") return route.fulfill({ json: {
      identity: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", osuUserId: 99, username: "fixture" },
      stats: { bpBalance: 100 }, createdAt: "2026-01-01T00:00:00.000Z",
    } });
    if (url.pathname === "/auth/access") return route.fulfill({ status: 204 });
    if (url.pathname === "/users/me/hunts") { state.hunts++; return route.fulfill({ json: [] }); }
    if (url.pathname === `/bounties/${id}`) { state.reads++; return route.fulfill({ json: state.bounty }); }
    return route.abort();
  });
  return state;
}
const views = (page: Page) => page.getByRole("group", { name: "Bounty views" });
const selected = (page: Page, name: string) => expect(views(page).getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");

for (const query of ["", "?view=invalid", "?view=overview"]) {
  test(`defaults to Overview for '${query}'`, async ({ page }) => {
    await setup(page);
    await page.goto(`/bounties/${id}${query}`);
    await selected(page, "Overview");
    await expect(page.getByRole("heading", { name: "Goal", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Beatmap", exact: true })).toBeVisible();
    await expect(page.getByText("Comments coming soon.")).toHaveCount(0);
    await expect(page.getByText("Ongoing Hunts", { exact: true })).toHaveCount(0);
    await expect(page.getByText("OPEN", { exact: true })).toBeVisible();
  });
}
for (const view of ["engagement", "comments"] as const) {
  test(`direct ${view} URL and reload select the matching view`, async ({ page }) => {
    await setup(page);
    await page.goto(`/bounties/${id}?view=${view}`);
    await selected(page, view === "comments" ? "Comments" : "Engagement");
    if (view === "comments") {
      await expect(page.getByText("Comments coming soon.")).toBeVisible();
      await expect(page.getByText("Ongoing Hunts", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText("Ongoing Hunts", { exact: true }).locator("..")).toHaveText(/-\s*Ongoing Hunts/);
      await expect(page.getByText("Bookmarks", { exact: true }).locator("..")).toHaveText(/3\s*Bookmarks/);
      await expect(page.getByText("Comments coming soon.")).toHaveCount(0);
    }
    await expect(page.getByText("OPEN", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Goal", exact: true })).toHaveCount(0);
    await page.reload();
    await selected(page, view === "comments" ? "Comments" : "Engagement");
    await expect(page.getByText(view === "comments" ? "Comments coming soon." : "Ongoing Hunts", { exact: true })).toBeVisible();
  });
}

test("switching preserves params/hash, Back/Forward, and mounted action controls", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/bounties/${id}?keep=1&keep=2#rules`);
  await selected(page, "Overview");
  await expect.poll(() => state.hunts).toBe(1);
  await expect(page.getByRole("button", { name: "Bookmark", exact: true })).toBeVisible();
  const hunt = await page.getByRole("button", { name: "Start Hunt", exact: true }).elementHandle();
  await views(page).getByRole("button", { name: "Engagement", exact: true }).click();
  await selected(page, "Engagement");
  expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["1", "2"]);
  expect(new URL(page.url()).hash).toBe("#rules");
  await views(page).getByRole("button", { name: "Comments", exact: true }).focus();
  await page.keyboard.press("Enter");
  await selected(page, "Comments");
  await page.goBack();
  await selected(page, "Engagement");
  await page.goForward();
  await selected(page, "Comments");
  await views(page).getByRole("button", { name: "Overview", exact: true }).click();
  await selected(page, "Overview");
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  expect(await hunt!.evaluate(element => element.isConnected)).toBe(true);
  expect(state.hunts).toBe(1);
  expect(state.posts).toBe(0);
});
for (const width of [320, 375, 390, 1280]) {
  test(`view controls fit and remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto(`/bounties/${id}`);
    for (const name of ["Overview", "Engagement", "Comments"]) {
      await views(page).getByRole("button", { name, exact: true }).click();
      await selected(page, name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}


for (const status of ["open", "completed", "cancelled"] as const) {
  test(`${status} banner stays above every view and closed bounties hide actions`, async ({ page }) => {
    await setup(page, { status });
    await page.goto(`/bounties/${id}`);
    for (const name of ["Overview", "Engagement", "Comments"]) {
      await views(page).getByRole("button", { name, exact: true }).click();
      const banner = page.getByText(status.toUpperCase(), { exact: true });
      await expect(banner).toBeVisible();
      expect(await banner.evaluate(element => !!(element.compareDocumentPosition(document.querySelector('[aria-label="Bounty views"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    }
    if (status !== "open") {
      await expect(page.getByRole("button", { name: "Start Hunt", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Bookmark", exact: true })).toHaveCount(0);
      await expect(page.getByText("There are currently no available actions")).toHaveCount(0);
    }
  });
}

for (const count of [0, 1, 12345]) {
  test(`engagement displays ${count} real bookmarks and unavailable hunt count`, async ({ page }) => {
    await setup(page, { engagement: { bookmarkCount: count, isBookmarkedByCurrentUser: false } });
    await page.goto(`/bounties/${id}?view=engagement`);
    const bookmarks = page.getByText(/^Bookmarks?$/).locator("..");
    await expect(bookmarks.locator("span")).toHaveText(count.toLocaleString("en-US"));
    await expect(page.getByText("Ongoing Hunts", { exact: true }).locator("..").locator("span")).toHaveText("-");
  });
}

test("bookmark stats update from polling without switching views", async ({ page }) => {
  await page.clock.install();
  const state = await setup(page);
  await page.goto(`/bounties/${id}?view=engagement`);
  const count = page.getByText("Bookmarks", { exact: true }).locator("..").locator("span");
  await expect(count).toHaveText("3");
  state.bounty.engagement = { bookmarkCount: 12, isBookmarkedByCurrentUser: false };
  await page.clock.fastForward(5100);
  await expect(count).toHaveText("12");
  await selected(page, "Engagement");
});

for (const status of ["completed", "cancelled"] as const) {
  for (const width of [320, 375, 390, 1280]) {
    test(`${status} spaced banner fits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page, { status });
      await page.goto(`/bounties/${id}?view=engagement`);
      const banner = page.getByText(status.toUpperCase(), { exact: true });
      await expect(banner).toBeVisible();
      expect(await banner.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement!.getBoundingClientRect();
        return rect.left >= parent.left && rect.right <= parent.right && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
    });
  }
}
