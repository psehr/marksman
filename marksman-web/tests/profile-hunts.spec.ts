import { expect, test, type Page } from "@playwright/test";
import type { ExtendedBounty, User, UserHuntedBounties } from "@marksman/contracts";

const owner: User = {
  identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 42, username: "slot-owner" },
  stats: { bpBalance: 100 }, createdAt: "2026-01-01T00:00:00.000Z",
};
const other: User = { ...owner, identity: {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", osuUserId: 43, username: "other-hunter",
} };
function pair(index: number): UserHuntedBounties[number] {
  const bounty: ExtendedBounty = {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    status: "open", rewardBp: index === 1 ? 12000 : 300, creatorOsuUserId: 43,
    createdAt: "2026-01-02T00:00:00.000Z", completedAt: null, cancelledAt: null,
    completedByOsuUserId: null, completionScoreId: null,
    goal: { type: "minimum_grade", minimumGradeRequirement: "A", beatmapId: index,
      beatmapChecksum: null, minimumAccuracy: 99.5,
      modRequirement: { rule: "exact", mods: ["HD", "HR", "DT"] } },
    owner: other.identity, winner: null,
    engagement: { bookmarkCount: 0, isBookmarkedByCurrentUser: null },
    beatmap: {
      url: `https://osu.ppy.sh/beatmaps/${index}`, version: { id: index, name: "Long difficulty title for sizing" },
      song: { title: `Hunted song ${index}`, artist: "Fixture artist" },
      specs: { sr: 5, ar: 9, od: 8, cs: 4, hp: 6, bpm: 180, length: { total: 120, drain: 110 }, maxCombo: 1000 },
      covers: null, creator: { id: 43, username: "fixture-mapper" }, stats: { status: "ranked", playcount: 10 },
    },
  };
  return { bounty, hunt: { id: `10000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    userId: owner.identity.id, bountyId: bounty.id, status: "ongoing",
    startedAt: "2026-01-03T00:00:00.000Z", endedAt: null } };
}
const slot = (page: Page, index: number) => page.getByText(`Hunting Slot #${index}`, { exact: true }).locator("..");

async function setup(page: Page, count = 0, signedIn = false) {
  const state = { count, reads: 0, failure: "" };
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:3100") return route.continue();
    return route.abort("blockedbyclient");
  });
  await page.route("**/auth/me", route => route.fulfill(signedIn ? { json: owner } : { status: 401, json: {} }));
  await page.route("**/users/*", route => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const profile = [owner, other].find(user => user.identity.id === id);
    return profile ? route.fulfill({ json: profile }) : route.fallback();
  });
  await page.route("**/users/*/bounty-events?*", route => route.fulfill({ json: [] }));
  await page.route("**/users/me/ledger?*", route => route.fulfill({ json: [] }));
  await page.route("**/users/*/hunts", route => {
    state.reads++;
    if (state.failure === "network") return route.abort("failed");
    if (state.failure === "http") return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    if (state.failure === "schema") return route.fulfill({ json: [{}] });
    return route.fulfill({ json: Array.from({ length: state.count }, (_, i) => pair(i + 1)) });
  });
  return state;
}

for (const count of [0, 1, 2]) {
  test(`profile displays ${count} hunted cards and ${2 - count} empty holders`, async ({ page }) => {
    await setup(page, count, count === 2);
    await page.goto(`/users/${owner.identity.id}`);
    await expect(slot(page, 1)).toBeVisible();
    await expect(slot(page, 2)).toBeVisible();
    await expect(page.getByText("Empty Hunting Slot", { exact: true })).toHaveCount(2 - count);
    for (let i = 1; i <= count; i++) {
      const card = slot(page, i).getByRole("link");
      await expect(card).toContainText(`Hunted song ${i}`);
      await expect(card).toHaveAttribute("href", `/bounties/${pair(i).bounty.id}`);
    }
  });
}

for (const failure of ["http", "network", "schema"]) {
  test(`${failure} hunt failure keeps profile usable and Retry restores cards`, async ({ page }) => {
    const state = await setup(page, 1);
    state.failure = failure;
    await page.goto(`/users/${owner.identity.id}`);
    await expect(page.getByText("Error loading hunts", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events", exact: true })).toBeVisible();
    await expect(page.getByText("Empty Hunting Slot", { exact: true })).toHaveCount(0);
    state.failure = "";
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(slot(page, 1).getByRole("link")).toContainText("Hunted song 1");
    await expect(page.getByText("Empty Hunting Slot", { exact: true })).toHaveCount(1);
    expect(state.reads).toBe(2);
  });
}

test("slow old-profile response cannot replace the current profile's slots", async ({ page }) => {
  await setup(page, 0, true);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(`**/users/${other.identity.id}/hunts`, async route => {
    started();
    await gate;
    await route.fulfill({ json: [pair(1)] }).catch(() => {});
  });
  try {
    await page.goto(`/users/${other.identity.id}`);
    await requested;
    await expect(page.getByText("Loading hunts...", { exact: true })).toBeVisible();
    await expect(page.getByText("Empty Hunting Slot", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Profile", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/users/${owner.identity.id}$`));
    await expect(page.getByText("Empty Hunting Slot", { exact: true })).toHaveCount(2);
    release();
    await expect(slot(page, 1).getByRole("link")).toHaveCount(0);
  } finally { release(); }
});

for (const width of [320, 375, 390, 1280]) {
  test(`slot layout and keyboard links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page, 1);
    await page.goto(`/users/${owner.identity.id}`);
    await expect(slot(page, 1).getByRole("link")).toBeVisible();
    await expect(slot(page, 2)).toBeVisible();
    const first = (await slot(page, 1).boundingBox())!;
    const second = (await slot(page, 2).boundingBox())!;
    expect(Math.abs(first.width - second.width)).toBeLessThan(2);
    if (width < 1024) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    else {
      expect(Math.abs(first.y - second.y)).toBeLessThan(2);
      expect(Math.abs(first.height - second.height)).toBeLessThan(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const card = slot(page, 1).getByRole("link");
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThan(first.x);
    expect(cardBox.x + cardBox.width).toBeLessThan(first.x + first.width);
    expect(cardBox.y).toBeGreaterThan(first.y);
    expect(cardBox.y + cardBox.height).toBeLessThan(first.y + first.height);
    if (width === 320 || width === 1280) {
      await page.screenshot({ path: `/tmp/marksman-profile-slots-${width}.png`, fullPage: true });
    }
    // A card can fit its holder while flex shrink hides the metadata section.
    const title = card.getByText("Hunted song 1", { exact: true });
    await expect(title).toBeVisible();
    expect(await title.evaluate(el => {
      const titleRect = el.getBoundingClientRect();
      const panelRect = el.closest("div.relative.h-24")!.getBoundingClientRect();
      return titleRect.top >= panelRect.top && titleRect.bottom <= panelRect.bottom;
    })).toBe(true);
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/bounties/${pair(1).bounty.id}$`));
  });
}
