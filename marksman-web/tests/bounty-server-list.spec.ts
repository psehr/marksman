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
async function setup(page: Page, handler: (params: URLSearchParams) => Promise<unknown> | unknown) {
  await page.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:3100" ? route.continue() : route.abort());
  await page.route("**/auth/me", route => route.fulfill({ status: 401, json: {} }));
  await page.route(/\/bounties(?:\?.*)?$/, async route => {
    if (route.request().isNavigationRequest() || route.request().headers()["rsc"]) return route.fallback();
    await route.fulfill({ json: await handler(new URL(route.request().url()).searchParams) });
  });
}

test("sends all URL filters, uses server results and totals, and falls back anonymously", async ({ page }) => {
  const requests: URLSearchParams[] = [];
  await setup(page, params => { requests.push(params); return { items: [fixtures[0]], total: 45, page: 2, pageSize: 20 }; });
  await page.goto("/bounties?status=completed&tiers=Normal,Hard&goals=full_combo&mods=HD,HR&search=unmatched&sort=reward&order=asc&relationship=created&page=2");
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  expect(Object.fromEntries(requests.at(-1)!)).toMatchObject({ status: "completed", tiers: "Normal,Hard", goals: "full_combo", mods: "HD,HR", search: "unmatched", sort: "reward", order: "asc", relationship: "all", page: "2" });
});

test("pagination preserves filters, supports history and resets on filter change", async ({ page }) => {
  await setup(page, params => ({ items: [fixtures[Number(params.get("page")) - 1]], total: 45, page: Number(params.get("page")), pageSize: 20 }));
  await page.goto("/bounties?tiers=Hard&keep=yes");
  await expect(cards(page)).toHaveText([/Player1/]);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(cards(page)).toHaveText([/Player2/]);
  expect(new URL(page.url()).searchParams.get("keep")).toBe("yes");
  await page.goBack();
  await expect(cards(page)).toHaveText([/Player1/]);
  await page.goForward();
  await expect(cards(page)).toHaveText([/Player2/]);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(cards(page)).toHaveText([/Player1/]);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
});

test("ignores an older search response and recovers an out of range page", async ({ page }) => {
  let release: (() => void) | undefined;
  let started = false;
  await setup(page, async params => {
    if (params.get("search") === "slow") {
      started = true;
      await new Promise<void>(resolve => { release = resolve; });
      return { items: [fixtures[0]], total: 1, page: 1, pageSize: 20 };
    }
    return { items: params.get("page") === "9" ? [] : [fixtures[1]], total: 1, page: Number(params.get("page")), pageSize: 20 };
  });
  await page.goto("/bounties?page=9");
  await page.getByRole("button", { name: "First page" }).click();
  await expect(cards(page)).toHaveText([/Player2/]);
  const search = page.getByRole("textbox", { name: "Search bounties" });
  await search.fill("slow");
  await expect.poll(() => started).toBe(true);
  await search.fill("new");
  await expect(cards(page)).toHaveText([/Player2/]);
  release!();
  await page.waitForTimeout(350);
  await expect(cards(page)).toHaveText([/Player2/]);
});

for (const failure of ["http", "network", "schema"] as const) {
  test(`recovers from ${failure} failure after a query change`, async ({ page }) => {
    await setup(page, () => ({ items: [fixtures[0]], total: 1, page: 1, pageSize: 20 }));
    let fail = true;
    await page.route(/\/bounties(?:\?.*)?$/, route => {
      if (route.request().isNavigationRequest() || route.request().headers()["rsc"] || !fail) return route.fallback();
      if (failure === "network") return route.abort("failed");
      return route.fulfill({ status: failure === "http" ? 503 : 200, json: {} });
    });
    await page.goto("/bounties");
    await expect(page.getByText("Failed to load bounties", { exact: true })).toBeVisible();
    fail = false;
    await page.getByRole("textbox", { name: "Search bounties" }).fill("retry");
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByText("Failed to load bounties", { exact: true })).toHaveCount(0);
  });
}


test("Pass URL filter survives reload, toggle and browser history", async ({ page }) => {
  const requests: string[] = [];
  await setup(page, params => {
    requests.push(params.get("goals") ?? "");
    return { items: [{ ...fixtures[0], goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { rule: "any" } } }], total: 1, page: 1, pageSize: 20 };
  });
  await page.goto("/bounties?goals=pass&keep=yes");
  await page.getByText("Show additional filters", { exact: true }).click();
  const button = page.getByRole("button", { name: "Clear/Pass", exact: true });
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(cards(page)).toContainText("Clear/Pass");
  await expect.poll(() => requests.at(-1)).toBe("pass");
  await page.reload();
  await page.getByText("Show additional filters", { exact: true }).click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.focus(); await button.press("Enter");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => requests.at(-1)).toBe("");
  expect(new URL(page.url()).searchParams.get("keep")).toBe("yes");
  await page.goBack();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => requests.at(-1)).toBe("pass");
});

for (const width of [320, 375, 390, 1280]) {
  test(`goal filters and badges fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const pass = { ...fixtures[2], goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { rule: "any" } } };
    await setup(page, () => ({ items: [fixtures[0], fixtures[1], pass], total: 3, page: 1, pageSize: 20 }));
    await page.goto("/bounties?goals=pass");
    await expect(cards(page)).toHaveCount(3);
    await page.getByText("Show additional filters", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Clear/Pass", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const badgeColors = await cards(page).locator('[title="A full-combo is required."], [title="Clear/Pass the map without using No-Fail"], [title="Achieve a minimum grade of A"]').evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
    expect(new Set(badgeColors).size).toBe(3);
    if (width === 320) await page.screenshot({ path: "/tmp/marksman-pass-filters-320.png", fullPage: true });
  });
}
