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
const creators = (page: Page) => page.locator('a[href^="/bounties/"]').filter({ hasText: /Created by|Completed|Cancelled/ });
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
  await page.getByRole("combobox", { name: "Sort by" }).selectOption("bpReward");
  await expect(creators(page)).toHaveText([/Alpha/, /Beta/]);
  await page.getByRole("button", { name: "Descending order; switch to ascending", exact: true }).click();
  await expect(creators(page)).toHaveText([/Beta/, /Alpha/]);
  await page.getByRole("button", { name: "Created", exact: true }).click();
  await expect(creators(page)).toHaveText([/Alpha/]);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("textbox", { name: "Search bounties" }).fill("zzzzzzzz");
  await expect(page.getByText("No bounties found", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search bounties" }).fill("Alpha");
  await expect(creators(page)).toHaveText([/Alpha/]);
  await page.getByRole("textbox", { name: "Search bounties" }).fill("");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(creators(page)).toHaveText([/Completed/]);
  await page.goBack();
  await expect(creators(page)).toHaveText([/Beta/, /Alpha/]);
  await page.goForward();
  await expect(creators(page)).toHaveText([/Completed/]);
  expect(reads()).toEqual({ all: 1, bookmarked: 0 });
  await page.reload();
  await expect(creators(page)).toHaveText([/Completed/]);
});

test("bookmark switching fetches the selected endpoint and filters its statuses", async ({ page }) => {
  const reads = await setup(page);
  await page.goto("/bounties");
  await expect(creators(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Bookmarked", exact: true }).click();
  await expect(creators(page)).toHaveText([/Beta/]);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(creators(page)).toHaveText([/Completed/]);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect.poll(reads).toEqual({ all: 2, bookmarked: 1 });
  await expect(creators(page)).toHaveText([/Completed/]);
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
  await expect(page.getByText("No bounties to display", { exact: true })).toBeVisible();
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

test("official mod badges load local SVGs and retain labels, sizes and exclusions", async ({ page }) => {
  await setup(page);
  const supported = ["EZ", "HD", "HR", "DT", "HT", "FL", "NF", "SO"] as const;
  const names = ["Easy", "Hidden", "Hard Rock", "Double Time", "Half Time", "Flashlight", "No Fail", "Spun Out"];
  const fixtures = supported.map((mod, index) => ({
    ...rows[0],
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    goal: { ...rows[0].goal, modRequirement: { rule: "exact", mods: [mod] } },
  }));
  const extra = [
    { rule: "exact", mods: [] },
    { rule: "any" },
    { rule: "excludes", mods: ["HR"] },
  ].map((modRequirement, index) => ({
    ...rows[0], id: `00000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
    goal: { ...rows[0].goal, modRequirement },
  }));
  await page.route("**/bounties", route => route.request().isNavigationRequest()
    ? route.fallback() : route.fulfill({ json: [...fixtures, ...extra] }));
  await page.goto("/bounties");
  for (const name of [...names, "No mods", "Hard Rock forbidden"]) {
    const icon = page.getByRole("img", { name, exact: true });
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("title", name);
    const box = await icon.boundingBox();
    expect(box!.height).toBe(24);
    expect(box!.width / box!.height).toBeCloseTo(120 / 84, 1);
  }
  await expect(page.getByRole("img", { name: "Hard Rock forbidden", exact: true }).locator("svg")).toHaveCount(1);
  const files = ["icon", "easy", "hidden", "hard-rock", "double-time", "half-time", "flashlight", "no-fail", "spun-out", "no-mod"];
  for (const file of files) {
    const response = await page.request.get(`/images/mods/mod-${file}.svg`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain("<svg");
  }
  const glyph = page.getByRole("img", { name: "Hard Rock", exact: true }).locator("span span").last();
  await expect(glyph).toHaveCSS("mask-image", /mod-hard-rock\.svg/);
  await page.screenshot({ path: "/tmp/marksman-mod-icons.png", fullPage: true });
});

const metadata: NonNullable<ExtendedBounty["beatmap"]> = {
  url: "https://osu.ppy.sh/beatmaps/42", version: { id: 42, name: "A long difficulty name for mobile layout" },
  song: { title: "A long song title for mobile layout", artist: "Example artist" },
  specs: { sr: 5, ar: 9, od: 8, cs: 4, hp: 5, bpm: 180, length: { total: 120, drain: 100 }, maxCombo: 500 },
  covers: null, creator: { id: 456, username: "Example mapper" },
  stats: { status: "ranked", playcount: 100 },
};

test("missing metadata and missing covers render cards without invalid images", async ({ page }) => {
  await setup(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/bounties", route => route.request().isNavigationRequest()
    ? route.fallback() : route.fulfill({ json: [rows[0], { ...rows[1], beatmap: metadata }] }));
  await page.goto("/bounties");
  await expect(creators(page)).toHaveCount(2);
  await expect(creators(page).locator('img[data-nimg="fill"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("cards support Tab, visible focus, hover and Enter and expose accuracy", async ({ page }) => {
  await setup(page);
  const fixture = { ...rows[0], goal: { ...rows[0].goal, minimumAccuracy: 98.5 } };
  await page.route("**/bounties", route => route.request().isNavigationRequest()
    ? route.fallback() : route.fulfill({ json: [fixture, rows[1]] }));
  await page.goto("/bounties");
  const cards = creators(page);
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(1)).toHaveAccessibleName(/Accuracy >=98.5%/);
  await page.getByRole("button", { name: "Desc ↓", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(cards.first()).toBeFocused();
  await expect(cards.first()).toHaveCSS("border-top-color", "rgb(230, 198, 91)");
  await page.keyboard.press("Tab");
  await expect(cards.nth(1)).toBeFocused();
  await cards.first().hover();
  await expect(cards.first()).toHaveCSS("border-top-color", "rgb(230, 198, 91)");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/bounties/${fixture.id}$`));
});

for (const width of [375, 1280]) {
  test(`card grid fits viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.route("**/bounties", route => route.request().isNavigationRequest()
      ? route.fallback() : route.fulfill({ json: rows.slice(0, 2).map(row => ({
        ...row, beatmap: metadata, goal: { ...row.goal, minimumAccuracy: 98.5, modRequirement: { rule: "exact", mods: ["HD", "HR", "DT"] } },
      })) }));
    await page.goto("/bounties");
    const cards = creators(page);
    await expect(cards).toHaveCount(2);
    const boxes = await cards.evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, width: element.clientWidth, scroll: element.scrollWidth };
    }));
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.scroll).toBeLessThanOrEqual(box.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 375) expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
    else expect(boxes[1].y).toBe(boxes[0].y);
    await page.screenshot({ path: `/tmp/marksman-cards-${width}.png`, fullPage: true });
  });
}

test("detail card fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await setup(page, false);
  const fixture = { ...rows[0], beatmap: metadata, goal: { ...rows[0].goal, minimumAccuracy: 98.5 } };
  await page.route(`**/bounties/${fixture.id}`, route =>
    route.request().isNavigationRequest() || route.request().headers()["rsc"]
      ? route.fallback() : route.fulfill({ json: fixture }));
  await page.goto(`/bounties/${fixture.id}`);
  const card = creators(page);
  await expect(card).toHaveCount(1);
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(16);
  expect(box!.width).toBeGreaterThan(300);
  expect(box!.x + box!.width).toBeLessThanOrEqual(359);
  await page.screenshot({ path: "/tmp/marksman-detail-mobile.png", fullPage: true });
  const overflow = await page.locator("body *").evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().right > 375).map(element => ({ tag: element.tagName, text: element.textContent?.slice(0, 100) })));
  expect(await page.evaluate(() => document.documentElement.scrollWidth), JSON.stringify(overflow)).toBeLessThanOrEqual(375);
});

test("official grade badges preserve minimum labels and load all grade variants", async ({ page }) => {
  await setup(page, false);
  const grades = ["D", "C", "B", "A", "S", "SH", "X", "XH"] as const;
  const files = ["D", "C", "B", "A", "S", "S-Silver", "SS", "SS-Silver"];
  const labels = ["D", "C", "B", "A", "S", "Silver S", "SS", "Silver SS"];
  const fixtures = grades.map((grade, index) => ({
    ...bounty(index + 1, `Grade ${grade}`, "open", 100),
    goal: { ...rows[0].goal, minimumGradeRequirement: grade },
  }));
  const fullCombo = { ...bounty(9, "FC player", "open", 100),
    goal: { type: "full_combo", beatmapId: 42, beatmapChecksum: null,
      minimumComboRatio: 0.99, modRequirement: { rule: "any" } } };
  await page.route("**/bounties", route => route.request().isNavigationRequest()
    ? route.fallback() : route.fulfill({ json: [...fixtures, fullCombo] }));
  await page.goto("/bounties");
  for (const [index, label] of labels.entries()) {
    const badge = page.getByRole("img", { name: `Minimum grade: ${label}`, exact: true });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("≥");
    const artwork = badge.locator("span").last();
    await expect(artwork).toHaveCSS("background-image", new RegExp(`GradeSmall-${files[index]}\\.svg`));
    const box = await artwork.boundingBox();
    expect(box?.height).toBe(24);
    expect(box?.width).toBe(48);
    const response = await page.request.get(`/images/grades/GradeSmall-${files[index]}.svg`);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).toContain('<svg width="32" height="16"');
  }
  await expect(page.getByTitle("A full-combo is required.", { exact: true })).toHaveText("FC");
});
