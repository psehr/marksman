import type { ExtendedBounty } from "@marksman/contracts";
import { expect, test } from "@playwright/test";

const bounty: ExtendedBounty = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "open",
  rewardBp: 300,
  creatorOsuUserId: 67890,
  createdAt: "2025-01-02T00:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  completedByOsuUserId: null,
  completionScoreId: null,
  goal: {
    type: "minimum_grade",
    beatmapId: 42,
    beatmapChecksum: null,
    minimumGradeRequirement: "A",
    modRequirement: { rule: "any" },
  },
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    osuUserId: 67890,
    username: "mapmaker",
  },
  winner: null,
  engagement: {
    bookmarkCount: 0,
    isBookmarkedByCurrentUser: null,
  },
  beatmap: {
    url: "https://osu.ppy.sh/beatmaps/42",
    version: { id: 42, name: "Expert" },
    song: { title: "Starlight", artist: "Aurora" },
    specs: {
      sr: 5,
      ar: 9,
      od: 8,
      cs: 4,
      hp: 6,
      bpm: 180,
      length: { total: 120, drain: 110 },
      maxCombo: 1000,
    },
    covers: {
      cover: "https://assets.ppy.sh/beatmaps/42/covers/cover.jpg",
      card: "https://assets.ppy.sh/beatmaps/42/covers/card.jpg",
    },
    creator: { id: 7, username: "mapper" },
    stats: { status: "ranked", playcount: 1000 },
  },
};

for (const [label, ratio, missing] of [
  ["default", undefined, false],
  ["custom", 0.995, false],
  ["missing metadata", undefined, true],
] as const) {
  test(`stable FC detail threshold: ${label}`, async ({ page }) => {
    const data: ExtendedBounty = {
      ...bounty,
      goal: { type: "full_combo", beatmapId: 42, beatmapChecksum: null,
        modRequirement: { rule: "any" }, minimumComboRatio: ratio },
      beatmap: missing ? null : bounty.beatmap,
    };
    await page.route("**/auth/me", route => route.fulfill({ status: 401, json: {} }));
    await page.route("**/_next/image?**", route => route.fulfill({ status: 204 }));
    await page.route(`**/bounties/${bounty.id}`, route => {
      if (route.request().isNavigationRequest() || route.request().headers()["rsc"]) return route.fallback();
      return route.fulfill({ json: data });
    });
    await page.goto(`/bounties/${bounty.id}`);
    await expect(page.getByText("osu!stable requirements:", { exact: true })).toBeVisible();
    await expect(page.getByText(`Stable-Combo-Threshold: ${(ratio ?? 0.99) * 100}%`, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Learn more", exact: true })).toHaveAttribute("href", "/about/bounties#fc-ruling");
    if (missing) {
      await expect(page.getByText("Minimum required combo: /", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText(`Minimum required combo: ${Math.ceil(1000 * (ratio ?? 0.99))}/1000`, { exact: true })).toBeVisible();
    }
  });
}


test("Pass detail displays its goal and intrinsic NF restriction", async ({ page }) => {
  const data: ExtendedBounty = { ...bounty, goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { rule: "any" } } };
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: {} }));
  await page.route("**/_next/image?**", route => route.fulfill({ status: 204 }));
  await page.route(`**/bounties/${bounty.id}`, route => route.request().isNavigationRequest() || route.request().headers()["rsc"] ? route.fallback() : route.fulfill({ json: data }));
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByText("Clear/Pass", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Clear/Pass the map without using No-Fail.", { exact: true })).toBeVisible();
  await expect(page.getByText("Stable-Combo-Threshold:", { exact: false })).toHaveCount(0);
});
