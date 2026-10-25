import { expect, test, type Page } from "@playwright/test";
import type { ExtendedBounty, User } from "@marksman/contracts";

const user: User = {
  identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 123, username: "viewer" },
  stats: { bpBalance: 250 }, createdAt: "2026-01-01T00:00:00.000Z",
};
function bounty(index: number, username: string, status: ExtendedBounty["status"], rewardBp: number): ExtendedBounty {
  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    status, rewardBp, creatorOsuUserId: index === 1 ? 123 : 456,
    createdAt: `2026-01-0${index}T00:00:00.000Z`, completedAt: null,
    cancelledAt: null, completedByOsuUserId: null, completionScoreId: null,
    goal: { type: "minimum_grade", beatmapId: 42, beatmapChecksum: null,
      minimumGradeRequirement: "A", modRequirement: { rule: "any" } },
    beatmap: null, owner: { id: user.identity.id, osuUserId: index === 1 ? 123 : 456, username }, winner: null,
    engagement: { bookmarkCount: 0, isBookmarkedByCurrentUser: null },
  };
}
const rows = [bounty(1, "Alpha", "open", 300), bounty(2, "Beta", "open", 100), bounty(3, "Gamma", "completed", 200)];
const creators = (page: Page) => page.locator("p").filter({ hasText: /^Created .* ago by/ });
async function setup(page: Page, signedIn = true) {
  let all = 0;
  let bookmarked = 0;
  await page.route("**/auth/me", route => route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? user : {} }));
  await page.route("**/bounties", route => {
    if (route.request().isNavigationRequest()) return route.fallback();
    all++;
    return route.fulfill({ json: rows });
  });
  await page.route("**/users/me/bookmarked-bounties", route => {
    bookmarked++;
    return route.fulfill({ json: [rows[1], rows[2]] });
  });
  return () => ({ all, bookmarked });
}

test("local controls update results without refetching or losing the original data", async ({ page }) => {
  const reads = await setup(page);
  await page.goto("/bounties");
  await expect(creators(page)).toHaveText([/Beta/, /Alpha/]);
  await page.getByRole("button", { name: "Reward", exact: true }).click();
  await expect(creators(page)).toHaveText([/Alpha/, /Beta/]);
  await page.getByRole("button", { name: "Asc ↑", exact: true }).click();
  await expect(creators(page)).toHaveText([/Beta/, /Alpha/]);
  await page.getByRole("button", { name: "My bounties", exact: true }).click();
  await expect(creators(page)).toHaveText([/Alpha/]);
  await page.getByRole("button", { name: "All bounties", exact: true }).click();
  await page.getByRole("textbox", { name: "Search bounties" }).fill("zzzzzzzz");
  await expect(page.getByText("No matching bounties", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search bounties" }).fill("Alpha");
  await expect(creators(page)).toHaveText([/Alpha/]);
  await page.getByRole("textbox", { name: "Search bounties" }).fill("");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(creators(page)).toHaveText([/Gamma/]);
  await page.goBack();
  await expect(creators(page)).toHaveText([/Beta/, /Alpha/]);
  await page.goForward();
  await expect(creators(page)).toHaveText([/Gamma/]);
  expect(reads()).toEqual({ all: 1, bookmarked: 0 });
  await page.reload();
  await expect(creators(page)).toHaveText([/Gamma/]);
});

test("bookmark switching fetches the selected endpoint and filters its statuses", async ({ page }) => {
  const reads = await setup(page);
  await page.goto("/bounties");
  await expect(creators(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Bookmarked bounties", exact: true }).click();
  await expect(creators(page)).toHaveText([/Beta/]);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(creators(page)).toHaveText([/Gamma/]);
  await page.getByRole("button", { name: "All bounties", exact: true }).click();
  await expect.poll(reads).toEqual({ all: 2, bookmarked: 1 });
  await expect(creators(page)).toHaveText([/Gamma/]);
});

for (const relationship of ["created", "bookmarked"]) {
  test(`signed-out ${relationship} URL falls back to all`, async ({ page }) => {
    const reads = await setup(page, false);
    await page.goto(`/bounties?relationship=${relationship}`);
    await expect(creators(page)).toHaveText([/Beta/, /Alpha/]);
    expect(reads()).toEqual({ all: 1, bookmarked: 0 });
  });
}

test("empty status has the no-bounties message", async ({ page }) => {
  await setup(page);
  await page.route("**/bounties", route => route.request().isNavigationRequest()
    ? route.fallback() : route.fulfill({ json: [rows[0]] }));
  await page.goto("/bounties?status=completed");
  await expect(page.getByText("No bounties available", { exact: true })).toBeVisible();
});

for (const failure of ["http", "network", "schema"]) {
  test(`list reports ${failure} failure`, async ({ page }) => {
    await setup(page);
    await page.route("**/bounties", route => {
      if (route.request().isNavigationRequest()) return route.fallback();
      if (failure === "network") return route.abort("failed");
      return route.fulfill({ status: failure === "http" ? 503 : 200, json: {} });
    });
    await page.goto("/bounties");
    await expect(page.getByText("Failed to load bounties", { exact: true })).toBeVisible();
  });
}
