import { listResponse, listUrl } from "./fixtures/bounty-list-api";
import { expect, test, type Page } from "@playwright/test";
import type { ExtendedBounty } from "@marksman/contracts";

const rules: ExtendedBounty["goal"]["modRequirement"][] = [
  { rule: "exact", mods: ["HD", "HR"] },
  { rule: "includes", mods: ["HD", "HR"] },
  { rule: "exact", mods: ["HD"] },
  { rule: "excludes", mods: ["HD", "HR"] },
  { rule: "any" },
  { rule: "exact", mods: [] },
];
const rewards = [300, 1000, 100, 300, 10000, 1];
const fixtures: ExtendedBounty[] = rules.map((modRequirement, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  status: "open", rewardBp: rewards[index], creatorOsuUserId: 42,
  createdAt: `2026-01-0${index + 1}T00:00:00.000Z`,
  completedAt: null, cancelledAt: null, completedByOsuUserId: null, completionScoreId: null,
  goal: index % 2 === 0
    ? { type: "minimum_grade", minimumGradeRequirement: "A", beatmapId: 42, beatmapChecksum: null, modRequirement }
    : { type: "full_combo", minimumComboRatio: 0.99, beatmapId: 42, beatmapChecksum: null, modRequirement },
  beatmap: null, owner: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 42, username: `Player${index + 1}` },
  winner: null, engagement: { bookmarkCount: 0, isBookmarkedByCurrentUser: null },
}));
const cards = (page: Page) => page.locator('a[href^="/bounties/"]').filter({ hasText: "Created by" });
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const tier = (page: Page, name: string) => group(page, "Reward Tier").getByRole("button", { name: `Reward tier: ${name}`, exact: true });
const goal = (page: Page, name: string) => group(page, "Goal Type").getByRole("button", { name, exact: true });
const mod = (page: Page, name: string) => group(page, "Mods").getByRole("button", { name, exact: true });
async function setup(page: Page) {
  let reads = 0;
  await page.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:3100"
    ? route.continue() : route.abort());
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: {} }));
  await page.route(listUrl, route => {
    if (route.request().isNavigationRequest() || route.request().headers()["rsc"]) return route.fallback();
    reads++;
    return route.fulfill({ json: listResponse(fixtures, route.request().url()) });
  });
  return () => reads;
}
async function openFilters(page: Page) {
  await page.getByText("Show additional filters", { exact: true }).click();
}

test("tier multiselection follows URL history, preserves other parameters and refetches", async ({ page }) => {
  const reads = await setup(page);
  await page.goto("/bounties?sort=reward&order=asc&keep=yes");
  await expect(cards(page)).toHaveCount(6);
  await openFilters(page);
  await tier(page, "Hard").click();
  await expect(cards(page)).toHaveText([/Player1/, /Player4/]);
  await tier(page, "Lunatic").click();
  await expect(cards(page)).toHaveText([/Player1/, /Player4/, /Player2/]);
  expect(new URL(page.url()).searchParams.get("tiers")).toBe("Hard,Lunatic");
  expect(new URL(page.url()).searchParams.get("keep")).toBe("yes");
  await page.goBack();
  await expect(tier(page, "Lunatic")).toHaveAttribute("aria-pressed", "false");
  await expect(cards(page)).toHaveCount(2);
  await page.goForward();
  await expect(cards(page)).toHaveCount(3);
  expect(reads()).toBeGreaterThan(1);
  await page.reload();
  await expect(cards(page)).toHaveCount(3);
  await openFilters(page);
  await expect(tier(page, "Hard")).toHaveAttribute("aria-pressed", "true");
  await tier(page, "Hard").click();
  await tier(page, "Lunatic").click();
  await expect(cards(page)).toHaveCount(6);
  expect(new URL(page.url()).searchParams.has("tiers")).toBe(false);
});

test("goals use OR within their group and AND with tiers, search and status", async ({ page }) => {
  const reads = await setup(page);
  await page.goto("/bounties?tiers=Hard");
  await expect(cards(page)).toHaveCount(2);
  await openFilters(page);
  await goal(page, "Full-Combo").click();
  await expect(cards(page)).toHaveText([/Player4/]);
  await goal(page, "Minimum Grade").click();
  await expect(cards(page)).toHaveCount(2);
  await page.getByRole("textbox", { name: "Search bounties..." }).fill("zzzzzzzz");
  await expect(page.getByText("No bounties found", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search bounties..." }).fill("");
  await goal(page, "Full-Combo").click();
  await expect(cards(page)).toHaveText([/Player1/]);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.getByText("No bounties found", { exact: true })).toBeVisible();
  expect(reads()).toBeGreaterThan(1);
});

test("mods require every selected mod in exact/includes rules and combine with goal and tier", async ({ page }) => {
  const reads = await setup(page);
  await page.goto("/bounties");
  await expect(cards(page)).toHaveCount(6);
  await openFilters(page);
  await mod(page, "Hidden").click();
  await expect(cards(page)).toHaveText([/Player3/, /Player2/, /Player1/]);
  await mod(page, "Hard Rock").click();
  await expect(cards(page)).toHaveText([/Player2/, /Player1/]);
  await goal(page, "Full-Combo").click();
  await expect(cards(page)).toHaveText([/Player2/]);
  await tier(page, "Hard").click();
  await expect(page.getByText("No bounties found", { exact: true })).toBeVisible();
  await tier(page, "Hard").click();
  await goal(page, "Full-Combo").click();
  await mod(page, "Hidden").click();
  await mod(page, "Hard Rock").click();
  await expect(cards(page)).toHaveCount(6);
  expect(new URL(page.url()).searchParams.has("mods")).toBe(false);
  expect(new URL(page.url()).searchParams.has("goals")).toBe(false);
  expect(reads()).toBeGreaterThan(1);
});

test("NM is exact empty mods and mutually exclusive with other selections", async ({ page }) => {
  await setup(page);
  await page.goto("/bounties?mods=HD,HR");
  await expect(cards(page)).toHaveCount(2);
  await openFilters(page);
  await mod(page, "No mods").click();
  await expect(cards(page)).toHaveText([/Player6/]);
  expect(new URL(page.url()).searchParams.get("mods")).toBe("NM");
  await expect(mod(page, "Hidden")).toHaveAttribute("aria-pressed", "false");
  await mod(page, "Hidden").click();
  await expect(cards(page)).toHaveCount(3);
  await expect(mod(page, "No mods")).toHaveAttribute("aria-pressed", "false");
  expect(new URL(page.url()).searchParams.get("mods")).toBe("HD");
  await page.goto("/bounties?mods=HD,NM,HR");
  await expect(cards(page)).toHaveText([/Player6/]);
});

test("unknown and duplicate URL values are ignored without losing valid selections", async ({ page }) => {
  await setup(page);
  await page.goto("/bounties?tiers=bogus,Hard,Hard&goals=invalid,minimum_grade&mods=ANY,HD,HD");
  await expect(cards(page)).toHaveText([/Player1/]);
  await openFilters(page);
  await expect(tier(page, "Hard")).toHaveAttribute("aria-pressed", "true");
  await expect(goal(page, "Minimum Grade")).toHaveAttribute("aria-pressed", "true");
  await expect(mod(page, "Hidden")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/bounties?tiers=bogus&goals=invalid&mods=ANY");
  await expect(cards(page)).toHaveCount(6);
});

test("signed-out personal-filter fallback still respects additional filters", async ({ page }) => {
  await setup(page);
  await page.goto("/bounties?relationship=bookmarked&tiers=Lunatic&mods=HD");
  await expect(cards(page)).toHaveText([/Player2/]);
  await expect(group(page, "Show").getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(group(page, "Show").getByRole("button", { name: "Bookmarked", exact: true })).toBeDisabled();
});
