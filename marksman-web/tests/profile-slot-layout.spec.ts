import { mockAvatars } from "./fixtures/avatars";
import { expect, test, type Page } from "@playwright/test";
import type { ExtendedBounty, User, UserHuntedBounties } from "@marksman/contracts";
import { detailedUserFixture } from "./fixtures/users";

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
const wonRequest = (url: URL) => url.pathname === "/bounties" && url.searchParams.has("winnerId");
const createdRequest = (url: URL) => url.pathname === "/bounties" && url.searchParams.has("creatorId");
const slot = (page: Page, index: number) => page.getByText(`Hunting Slot #${index}`, { exact: true }).locator("..");

async function setup(page: Page, count = 0, signedIn = false) {
  const state = { count, reads: 0, failure: "" };
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === new URL(test.info().project.use.baseURL!).origin) return route.continue();
    return route.abort("blockedbyclient");
  });
  await mockAvatars(page);
  await page.route("**/auth/access", route => route.fulfill({ status: 204 }));
  await page.route("**/auth/me", route => route.fulfill(signedIn ? { json: owner } : { status: 401, json: {} }));
  await page.route("**/users/*", route => {
    if (!["fetch", "xhr"].includes(route.request().resourceType())) return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const profile = [owner, other].find(user => user.identity.id === id);
    return profile ? route.fulfill({ json: detailedUserFixture(profile, {
      bountiesWon: 12, bountyEarningsBp: 12345,
    }) }) : route.fallback();
  });
  await page.route("**/users/*/bounty-events?*", route => route.fulfill({ json: [] }));
  await page.route("**/users/me/ledger?*", route => route.fulfill({ json: [] }));
  await page.route(createdRequest, route => route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } }));
  await page.route(wonRequest, route => route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } }));
  await page.route("**/users/*/hunts", route => {
    state.reads++;
    if (state.failure === "network") return route.abort("failed");
    if (state.failure === "http") return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    if (state.failure === "schema") return route.fulfill({ json: [{}] });
    return route.fulfill({ json: Array.from({ length: state.count }, (_, i) => pair(i + 1)) });
  });
  return state;
}


for (const count of [1, 3]) {
  for (const width of [320, 390, 1024, 1280]) {
    test(`three-slot layout: ${count} populated at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page, count, true);
      await page.goto(`/users/${owner.identity.id}?view=hunting`);
      await expect(page.getByText("Empty Hunting Slot", { exact: true })).toHaveCount(3 - count);
      if (width < 1024) {
        const header = page.getByText("Your Balance", { exact: true }).locator("../../../..");
        await expect(header).toBeVisible();
        const headerBounds = (await header.boundingBox())!;
        const cardBounds = await header.locator(":scope > div").evaluateAll(elements =>
          elements.map(el => ({ width: el.getBoundingClientRect().width, x: el.getBoundingClientRect().x })),
        );
        expect(cardBounds).toHaveLength(3);
        for (const card of cardBounds) {
          expect(Math.abs(card.width - headerBounds.width)).toBeLessThan(2);
          expect(Math.abs(card.x - headerBounds.x)).toBeLessThan(2);
        }
      }
      const boxes = [];
      for (let index = 1; index <= 3; index++) {
        const holder = slot(page, index);
        await expect(holder).toBeVisible();
        const box = (await holder.boundingBox())!;
        boxes.push(box);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(await holder.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        if (index <= count) {
          const card = holder.getByRole("link");
          await expect(card).toContainText(`Hunted song ${index}`);
          const cardBox = (await card.boundingBox())!;
          expect(cardBox.x).toBeGreaterThan(box.x);
          expect(cardBox.x + cardBox.width).toBeLessThan(box.x + box.width);
          expect(cardBox.y + cardBox.height).toBeLessThan(box.y + box.height);
          const title = card.getByText(`Hunted song ${index}`, { exact: true });
          expect(await title.evaluate(el => {
            const titleRect = el.getBoundingClientRect();
            const panelRect = el.closest("div.relative.h-24")!.getBoundingClientRect();
            return titleRect.top >= panelRect.top && titleRect.bottom <= panelRect.bottom;
          })).toBe(true);
        }
      }
      for (const box of boxes) expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(2);
      if (width < 1024) {
        for (let i = 1; i < 3; i++) expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i-1].y + boxes[i-1].height);
      } else {
        expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2);
        expect(Math.abs(boxes[0].height - boxes[1].height)).toBeLessThan(2);
        expect(boxes[2].y).toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 320 || width === 1280) await page.screenshot({ path: `/tmp/marksman-three-slots-${count}-${width}.png`, fullPage: true });
      const lastCard = slot(page, count).getByRole("link");
      await lastCard.focus();
      await expect(lastCard).toBeFocused();
      await lastCard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/bounties/${pair(count).bounty.id}$`));
    });
  }
}
