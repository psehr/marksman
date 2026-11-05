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
const createdRequest = (url: URL) => url.pathname === "/bounties" && url.searchParams.has("creatorId");
const slot = (page: Page, index: number) => page.getByText(`Hunting Slot #${index}`, { exact: true }).locator("..");

for (const total of [0, 20, 21, 40]) {
  test(`created bounty pagination respects total ${total}`, async ({ page }) => {
    await setup(page);
    await page.route(createdRequest, route => {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get("creatorId")).toBe(owner.identity.id);
      const selectedPage = Number(params.get("page"));
      const count = Math.max(0, Math.min(20, total - (selectedPage - 1) * 20));
      return route.fulfill({ json: {
        items: Array.from({ length: count }, (_, index) => pair(index + 1).bounty),
        total, page: selectedPage, pageSize: 20,
      } });
    });
    await page.goto(`/users/${owner.identity.id}?view=created`);
    await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
    const next = page.getByRole("button", { name: ">", exact: true });
    if (total <= 20) {
      await expect(next).toHaveCount(0);
    } else {
      await next.click();
      await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
      await expect(next).toHaveCount(0);
      await page.getByRole("button", { name: "<", exact: true }).click();
      await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
      await expect(next).toBeVisible();
    }
  });
}

async function setup(page: Page, count = 0, signedIn = false) {
  const state = { count, reads: 0, failure: "" };
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === new URL(test.info().project.use.baseURL!).origin) return route.continue();
    return route.abort("blockedbyclient");
  });
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
  await page.route(createdRequest, route => route.fulfill({ json: createdResult("open", 1, 0) }));
  await page.route("**/users/*/hunts", route => {
    state.reads++;
    if (state.failure === "network") return route.abort("failed");
    if (state.failure === "http") return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    if (state.failure === "schema") return route.fulfill({ json: [{}] });
    return route.fulfill({ json: Array.from({ length: state.count }, (_, i) => pair(i + 1)) });
  });
  return state;
}

function createdResult(status = "open", selectedPage = 1, total = 1) {
  return {
    items: Array.from({ length: Math.max(0, Math.min(20, total - (selectedPage - 1) * 20)) }, (_, i) => {
      const bounty = pair(i + 1).bounty;
      return { ...bounty, status, creatorOsuUserId: owner.identity.osuUserId, owner: owner.identity,
        beatmap: { ...bounty.beatmap!, song: { title: `${status} result ${selectedPage}-${i}`, artist: "Fixture" } } };
    }),
    total, page: selectedPage, pageSize: 20,
  };
}

for (const signedIn of [false, true]) {
  test(`created bounties use viewed profile with ${signedIn ? "another signed-in user" : "anonymous viewer"}`, async ({ page }) => {
    await setup(page);
    if (signedIn) await page.route("**/auth/me", route => route.fulfill({ json: other }));
    await page.route(createdRequest, route => {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get("creatorId")).toBe(owner.identity.id);
      expect(params.get("relationship")).toBeNull();
      return route.fulfill({ json: createdResult() });
    });
    await page.goto(`/users/${owner.identity.id}?view=created`);
    await expect(page.getByText("open result 1-0", { exact: true })).toBeVisible();
    await expect(page.getByText("Total Earnings", { exact: true }).locator("..")).toContainText("12,345");
    await expect(page.getByText("Completed Bounties", { exact: true }).locator("..")).toContainText("12");
    await expect(page.getByText("Your Balance", { exact: true })).toHaveCount(0);
  });
}

test("created status controls reset pagination and support keyboard selection", async ({ page }) => {
  await setup(page);
  await page.route(createdRequest, route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: createdResult(params.get("status")!, Number(params.get("page")), 21) });
  });
  await page.goto(`/users/${owner.identity.id}?view=created`);
  await expect(page.getByRole("button", { name: "Open", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const [label, status] of [["Closed", "completed"], ["Cancelled", "cancelled"], ["Open", "open"]]) {
    await page.getByRole("button", { name: ">", exact: true }).click();
    await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
    const button = page.getByRole("button", { name: label, exact: true });
    await button.focus();
    await button.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
    await expect(page.getByText(`${status} result 1-0`, { exact: true })).toBeVisible();
  }
});

for (const failure of ["http", "network", "schema"]) {
  test(`created bounties ${failure} error can retry`, async ({ page }) => {
    await setup(page);
    let failed = true;
    await page.route(createdRequest, route => {
      if (!failed) return route.fulfill({ json: createdResult() });
      if (failure === "network") return route.abort("failed");
      return route.fulfill(failure === "http" ? { status: 503, json: {} } : { json: [] });
    });
    await page.goto(`/users/${owner.identity.id}?view=created`);
    await expect(page.getByText("Error loading bounties", { exact: true })).toBeVisible();
    await expect(page.getByText("No bounties found", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Page 1", { exact: true })).toHaveCount(0);
    failed = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByText("open result 1-0", { exact: true })).toBeVisible();
    await expect(page.getByText("Error loading bounties", { exact: true })).toHaveCount(0);
  });
}

test("created loading and empty states are distinct", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(createdRequest, async route => {
    await gate;
    await route.fulfill({ json: createdResult("open", 1, 0) });
  });
  await page.goto(`/users/${owner.identity.id}?view=created`);
  await expect(page.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  await expect(page.getByText("Loading...", { exact: true })).toBeVisible();
  await expect(page.getByText("No bounties found", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByText("No bounties found", { exact: true })).toBeVisible();
  await expect(page.getByText("Loading...", { exact: true })).toHaveCount(0);
});

test("slow previous status cannot replace current created bounties", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let finished!: () => void;
  const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route(createdRequest, async route => {
    const status = new URL(route.request().url()).searchParams.get("status")!;
    if (status === "open") await gate;
    await route.fulfill({ json: createdResult(status) });
    if (status === "open") finished();
  });
  await page.goto(`/users/${owner.identity.id}?view=created`);
  await page.getByRole("button", { name: "Closed", exact: true }).click();
  await expect(page.getByText("completed result 1-0", { exact: true })).toBeVisible();
  release();
  await done;
  await expect(page.getByText("completed result 1-0", { exact: true })).toBeVisible();
  await expect(page.getByText("open result 1-0", { exact: true })).toHaveCount(0);
});

test("slow previous page cannot replace a newly selected status", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  let finished!: () => void;
  const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route(createdRequest, async route => {
    const params = new URL(route.request().url()).searchParams;
    const selectedPage = Number(params.get("page"));
    if (selectedPage === 2) { started(); await gate; }
    await route.fulfill({ json: createdResult(params.get("status")!, selectedPage, 21) });
    if (selectedPage === 2) finished();
  });
  await page.goto(`/users/${owner.identity.id}?view=created`);
  await page.getByRole("button", { name: ">", exact: true }).click();
  await pending;
  await page.getByRole("button", { name: "Cancelled", exact: true }).click();
  await expect(page.getByText("cancelled result 1-0", { exact: true })).toBeVisible();
  release();
  await done;
  await expect(page.getByText("cancelled result 1-0", { exact: true })).toBeVisible();
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await expect(page.getByText("open result 2-0", { exact: true })).toHaveCount(0);
});

test("profile navigation resets created query and ignores previous profile response", async ({ page }) => {
  await setup(page, 0, true);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  let finished!: () => void;
  const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route(createdRequest, async route => {
    const params = new URL(route.request().url()).searchParams;
    const oldProfile = params.get("creatorId") === other.identity.id;
    const selectedPage = Number(params.get("page"));
    if (oldProfile && selectedPage === 2) { started(); await gate; }
    if (!oldProfile) {
      expect(params.get("status")).toBe("open");
      expect(selectedPage).toBe(1);
    }
    await route.fulfill({ json: createdResult(params.get("status")!, selectedPage, 21) });
    if (oldProfile && selectedPage === 2) finished();
  });
  await page.goto(`/users/${other.identity.id}?view=created`);
  await page.getByRole("button", { name: "Closed", exact: true }).click();
  await expect(page.getByText("completed result 1-0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: ">", exact: true }).click();
  await pending;
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/users/${owner.identity.id}$`));
  await page.getByRole("button", { name: "Created Bounties", exact: true }).click();
  await expect(page.getByText("open result 1-0", { exact: true })).toBeVisible();
  release();
  await done;
  await expect(page.getByText("open result 1-0", { exact: true })).toBeVisible();
  await expect(page.getByText("completed result 2-0", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open", exact: true })).toHaveAttribute("aria-pressed", "true");
});

for (const width of [320, 375, 390, 1280]) {
  test(`created bounties controls and cards fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.route(createdRequest, route => route.fulfill({ json: createdResult() }));
    await page.goto(`/users/${owner.identity.id}?view=created`);
    await expect(page.getByText("open result 1-0", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (width === 320) await page.screenshot({ path: test.info().outputPath("created-320.png"), fullPage: true });
    const controls = (await page.getByRole("button", { name: "Open", exact: true }).locator("..").boundingBox())!;
    for (const name of ["Open", "Closed", "Cancelled"]) {
      const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect.soft(bounds!.x).toBeGreaterThanOrEqual(controls.x - 1);
      expect.soft(bounds!.x + bounds!.width).toBeLessThanOrEqual(controls.x + controls.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
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
    await expect(page.getByText(owner.identity.username, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Activity", exact: true })).toBeEnabled();
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


for (const query of ["", "?view=unknown", "?view=Hunting"]) {
  test(`profile defaults to Hunting for ${query || "missing view"}`, async ({ page }) => {
    await setup(page);
    await page.goto(`/users/${owner.identity.id}${query}`);
    await expect(page.getByRole("button", { name: "Hunting", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(slot(page, 1)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toHaveCount(0);
  });
}

for (const [view, label] of [["activity", "Activity"], ["created", "Created Bounties"]] as const) {
  test(`direct ${view} URL survives reload`, async ({ page }) => {
    await setup(page);
    await page.goto(`/users/${owner.identity.id}?view=${view}`);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) await page.reload();
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("Hunting Slot #1", { exact: true })).toHaveCount(0);
      if (view === "activity") await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
      else await expect(page.getByText("No bounties found", { exact: true })).toBeVisible();
    }
  });
}

test("view buttons preserve query parameters and hash, with Back and Forward restoring content", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/users/${owner.identity.id}?keep=1&keep=2#profile`);
  const hunting = page.getByRole("button", { name: "Hunting", exact: true });
  const activity = page.getByRole("button", { name: "Activity", exact: true });
  const created = page.getByRole("button", { name: "Created Bounties", exact: true });
  await expect(slot(page, 1)).toBeVisible();
  const reads = state.reads;
  const historyLength = await page.evaluate(() => history.length);
  await hunting.click();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);

  await activity.focus();
  await page.keyboard.press("Enter");
  await expect(activity).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`\\?keep=1&keep=2&view=activity#profile$`));
  await created.click();
  await expect(created).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("No bounties found", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(activity).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await page.goBack();
  await expect(hunting).toHaveAttribute("aria-pressed", "true");
  await expect(slot(page, 1)).toBeVisible();
  await page.goForward();
  await expect(activity).toHaveAttribute("aria-pressed", "true");
  await hunting.click();
  await expect(page).toHaveURL(new RegExp(`\\?keep=1&keep=2#profile$`));
  await expect(slot(page, 1)).toBeVisible();
  expect(state.reads).toBe(reads);
});
