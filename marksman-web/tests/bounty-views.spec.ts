import { expect, test, type Page } from "@playwright/test";
import { linkedBeatmap } from "./fixtures/beatmap-links";
import type { ExtendedBounty, Hunt } from "@marksman/contracts";

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
  const state = { hunts: 0, reads: 0, posts: 0, ongoing: [] as Hunt[], huntFailure: false, bounty: { ...bounty, ...overrides } };
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
    if (url.pathname === "/users/me/hunts") { state.hunts++; return state.huntFailure ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: state.ongoing }); }
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
for (const view of ["engagement", "activity", "funding", "comments"] as const) {
  test(`direct ${view} URL and reload select the matching view`, async ({ page }) => {
    await setup(page);
    await page.goto(`/bounties/${id}?view=${view}`);
    await selected(page, view[0].toUpperCase() + view.slice(1));
    if (view !== "engagement") {
      const message = view === "activity" ? "Activity feed coming soon." : view === "funding" ? "Funding details coming soon." : "Comments coming soon.";
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByText("Ongoing Hunts", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText("Ongoing Hunts", { exact: true }).locator("..")).toHaveText(/-\s*Ongoing Hunts/);
      await expect(page.getByText("Bookmarks", { exact: true }).locator("..")).toHaveText(/3\s*Bookmarks/);
      await expect(page.getByText("Comments coming soon.")).toHaveCount(0);
    }
    await expect(page.getByText("OPEN", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Goal", exact: true })).toHaveCount(0);
    await page.reload();
    await selected(page, view[0].toUpperCase() + view.slice(1));
    await expect(page.getByText(view === "comments" ? "Comments coming soon." : view === "activity" ? "Activity feed coming soon." : view === "funding" ? "Funding details coming soon." : "Ongoing Hunts", { exact: true })).toBeVisible();
  });
}

test("switching preserves params/hash, Back/Forward, and mounted action controls", async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/bounties/${id}?keep=1&keep=2#rules`);
  await selected(page, "Overview");
  await expect.poll(() => state.hunts).toBe(1);
  await expect(page.getByRole("button", { name: "Bookmark", exact: true })).toBeVisible();
  const hunt = await page.getByRole("button", { name: "Start Hunting", exact: true }).elementHandle();
  await views(page).getByRole("button", { name: "Engagement", exact: true }).click();
  await selected(page, "Engagement");
  expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["1", "2"]);
  expect(new URL(page.url()).hash).toBe("#rules");
  await views(page).getByRole("button", { name: "Comments", exact: true }).focus();
  await page.keyboard.press("Enter");
  await selected(page, "Comments");
  for (const name of ["Activity", "Funding"]) {
    await views(page).getByRole("button", { name, exact: true }).click();
    await selected(page, name);
    expect(new URL(page.url()).searchParams.getAll("keep")).toEqual(["1", "2"]);
    expect(new URL(page.url()).hash).toBe("#rules");
  }
  await page.goBack();
  await selected(page, "Activity");
  await page.goForward();
  await selected(page, "Funding");
  await views(page).getByRole("button", { name: "Overview", exact: true }).click();
  await selected(page, "Overview");
  expect(new URL(page.url()).searchParams.has("view")).toBe(false);
  expect(await hunt!.evaluate(element => element.isConnected)).toBe(true);
  expect(state.hunts).toBe(1);
  expect(state.posts).toBe(0);
});
for (const width of [320, 375, 390, 640, 768, 1280]) {
  test(`view controls fit and remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await page.goto(`/bounties/${id}`);
    for (const name of ["Overview", "Engagement", "Activity", "Funding", "Comments"]) {
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
    for (const name of ["Overview", "Engagement", "Activity", "Funding", "Comments"]) {
      await views(page).getByRole("button", { name, exact: true }).click();
      const banner = page.getByText(status.toUpperCase(), { exact: true });
      await expect(banner).toBeVisible();
      expect(await banner.evaluate(element => !!(element.compareDocumentPosition(document.querySelector('[aria-label="Bounty views"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    }
    if (status !== "open") {
      await expect(page.getByRole("button", { name: "Start Hunting", exact: true })).toHaveCount(0);
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


const hunt: Hunt = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", bountyId: id,
  startedAt: "2026-11-10T12:00:00.000Z", endedAt: null, status: "ongoing",
};
const huntingMessage = (page: Page) => page.getByText("You are currently hunting this bounty.", { exact: true });

test("restored hunt message sits between the card and actions and survives view changes", async ({ page }) => {
  const state = await setup(page);
  state.ongoing = [hunt];
  await page.goto(`/bounties/${id}`);
  await expect(huntingMessage(page)).toBeVisible();
  expect(await huntingMessage(page).evaluate(element => {
    const card = document.querySelector('a[href="/bounties/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]')!;
    const stop = [...document.querySelectorAll('button')].find(button => button.textContent === "Stop Hunting")!;
    return !!(card.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !!(element.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await views(page).getByRole("button", { name: "Funding", exact: true }).click();
  await expect(huntingMessage(page)).toBeVisible();
  expect(state.hunts).toBe(1);
  await page.reload();
  await expect(huntingMessage(page)).toBeVisible();
});

test("message appears after start and disappears after stop", async ({ page }) => {
  const state = await setup(page);
  await page.route(`**/bounties/${id}/hunt`, async route => {
    state.ongoing = [hunt];
    await route.fulfill({ json: hunt });
  });
  await page.route(`**/hunts/${hunt.id}/stop`, async route => {
    state.ongoing = [];
    await route.fulfill({ json: { ...hunt, status: "stopped", endedAt: "2026-11-10T13:00:00.000Z" } });
  });
  await page.goto(`/bounties/${id}`);
  await expect(page.getByRole("button", { name: "Start Hunting", exact: true })).toBeEnabled();
  await expect(huntingMessage(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Start Hunting", exact: true }).click();
  await expect(huntingMessage(page)).toBeVisible();
  await page.getByRole("button", { name: "Stop Hunting", exact: true }).click();
  await expect(huntingMessage(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start Hunting", exact: true })).toBeEnabled();
});

test("uncertain hunt state hides the message until reload confirms the hunt", async ({ page }) => {
  const state = await setup(page);
  state.ongoing = [hunt];
  await page.route(`**/hunts/${hunt.id}/stop`, route => route.abort());
  await page.goto(`/bounties/${id}`);
  await expect(huntingMessage(page)).toBeVisible();
  await page.getByRole("button", { name: "Stop Hunting", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reload hunts", exact: true })).toBeVisible();
  await expect(huntingMessage(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Reload hunts", exact: true }).click();
  await expect(huntingMessage(page)).toBeVisible();
});

for (const mode of ["other-bounty", "owner", "closed", "failed-load"] as const) {
  test(`hunting feedback stays hidden for ${mode}`, async ({ page }) => {
    const state = await setup(page, mode === "owner" ? { creatorOsuUserId: 99 } : mode === "closed" ? { status: "completed" } : {});
    state.ongoing = [{ ...hunt, bountyId: mode === "other-bounty" ? "dddddddd-dddd-4ddd-8ddd-dddddddddddd" : id }];
    state.huntFailure = mode === "failed-load";
    await page.goto(`/bounties/${id}`);
    await selected(page, "Overview");
    if (mode === "other-bounty") await expect(page.getByRole("button", { name: "Start Hunting", exact: true })).toBeEnabled();
    if (mode === "failed-load") await expect(page.getByRole("button", { name: "Reload hunts", exact: true })).toBeVisible();
    await expect(huntingMessage(page)).toHaveCount(0);
    if (mode === "owner" || mode === "closed") expect(state.hunts).toBe(0);
  });
}


for (const mode of ["hunter", "owner", "completed", "cancelled"] as const) {
  test(`beatmap actions remain available for ${mode} across views`, async ({ page }) => {
    await setup(page, {
      beatmap: linkedBeatmap,
      ...(mode === "owner" ? { creatorOsuUserId: 99 } : {}),
      ...(mode === "completed" || mode === "cancelled" ? { status: mode } : {}),
    });
    await page.goto(`/bounties/${id}`);
    for (const name of ["Overview", "Activity", "Funding"]) {
      await views(page).getByRole("button", { name, exact: true }).click();
      const open = page.getByRole("link", { name: "Open in osu!", exact: true });
      const download = page.getByRole("link", { name: "Download on osu!", exact: true });
      await expect(open).toHaveAttribute("href", "osu://b/42");
      await expect(download).toHaveAttribute("href", "https://osu.ppy.sh/beatmapsets/987/download");
      await expect(download).toHaveAttribute("target", "_blank");
      await expect(open).toBeVisible();
      await expect(download).toBeVisible();
      expect(await open.evaluate(element => element.parentElement!.closest("a"))).toBeNull();
    }
  });
}

test("missing metadata still opens the difficulty but disables the download", async ({ page }) => {
  await setup(page);
  await page.goto(`/bounties/${id}`);
  await expect(page.getByRole("link", { name: "Open in osu!", exact: true })).toHaveAttribute("href", "osu://b/42");
  await expect(page.getByRole("button", { name: "Download on osu!", exact: true })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Download on osu!", exact: true })).toHaveCount(0);
});

for (const width of [320, 375, 390, 640, 1280]) {
  test(`beatmap action labels fit and accept keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, { beatmap: linkedBeatmap });
    await page.goto(`/bounties/${id}`);
    for (const name of ["Open in osu!", "Download on osu!"]) {
      const action = page.getByRole("link", { name, exact: true });
      await action.focus();
      await expect(action).toBeFocused();
      expect(await action.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("Share bounty follows Bookmark, copies a clean URL and clears feedback", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const links: string[] = [];
    (window as unknown as { copiedLinks: string[] }).copiedLinks = links;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (url: string) => { links.push(url); } } });
  });
  const state = await setup(page);
  await page.goto(`/bounties/${id}?view=funding&keep=1#rules`);
  const share = page.getByRole("button", { name: "Share bounty", exact: true });
  await expect(share).toBeVisible();
  expect(await share.evaluate(element => element.parentElement!.previousElementSibling?.textContent)).toBe("Bookmark");
  await share.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Link copied!", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copiedLinks: string[] }).copiedLinks)).toEqual([`http://127.0.0.1:3100/bounties/${id}`]);
  expect(state.posts).toBe(0);
  await page.clock.fastForward(2600);
  await expect(page.getByText("Link copied!", { exact: true })).toHaveCount(0);
});

test("clipboard failure provides a manual link and permits retry", async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { if (++calls === 1) throw new Error("Permission denied"); } } });
  });
  await setup(page);
  await page.goto(`/bounties/${id}`);
  await page.getByRole("button", { name: "Share bounty", exact: true }).click();
  const manual = page.getByRole("textbox", { name: "Bounty link", exact: true });
  await expect(manual).toHaveValue(`http://127.0.0.1:3100/bounties/${id}`);
  await manual.focus();
  expect(await manual.evaluate(element => {
    const input = element as HTMLInputElement;
    return input.selectionStart === 0 && input.selectionEnd === input.value.length;
  })).toBe(true);
  await page.getByRole("button", { name: "Share bounty", exact: true }).click();
  await expect(page.getByText("Link copied!", { exact: true })).toBeVisible();
  await expect(manual).toHaveCount(0);
  await expect(page.getByText("Could not copy the link. You can copy it below.")).toHaveCount(0);
});

test("share is locked while clipboard write is pending", async ({ page }) => {
  await page.addInitScript(() => {
    const harness = window as unknown as { finishCopy: () => void; copyCalls: number };
    harness.copyCalls = 0;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => {
      harness.copyCalls++;
      return new Promise<void>(resolve => { harness.finishCopy = resolve; });
    } } });
  });
  await setup(page);
  await page.goto(`/bounties/${id}`);
  await page.getByRole("button", { name: "Share bounty", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copying…", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { copyCalls: number }).copyCalls)).toBe(1);
  await page.evaluate(() => (window as unknown as { finishCopy: () => void }).finishCopy());
  await expect(page.getByRole("button", { name: "Share bounty", exact: true })).toBeEnabled();
  await expect(page.getByText("Link copied!", { exact: true })).toBeVisible();
});

for (const status of ["completed", "cancelled"] as const) {
  test(`closed ${status} bounty still has a share action`, async ({ page }) => {
    await setup(page, { status });
    await page.goto(`/bounties/${id}`);
    await expect(page.getByRole("button", { name: "Share bounty", exact: true })).toBeVisible();
  });
}

test("share follows Unbookmark for a saved bounty", async ({ page }) => {
  await setup(page, { engagement: { bookmarkCount: 3, isBookmarkedByCurrentUser: true } });
  await page.goto(`/bounties/${id}`);
  const share = page.getByRole("button", { name: "Share bounty", exact: true });
  await expect(share).toBeVisible();
  expect(await share.evaluate(element => element.parentElement!.previousElementSibling?.textContent)).toBe("Unbookmark");
});

test("missing clipboard API offers manual copying", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }); });
  await setup(page);
  await page.goto(`/bounties/${id}`);
  await page.getByRole("button", { name: "Share bounty", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Bounty link", exact: true })).toHaveValue(`http://127.0.0.1:3100/bounties/${id}`);
});

for (const width of [320, 640, 1280]) {
  test(`decorative action icons keep text names and fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page, { beatmap: linkedBeatmap });
    await page.goto(`/bounties/${id}`);
    const actions = [
      page.getByRole("button", { name: "Start Hunting", exact: true }),
      page.getByRole("button", { name: "Bookmark", exact: true }),
      page.getByRole("button", { name: "Share bounty", exact: true }),
      page.getByRole("link", { name: "Open in osu!", exact: true }),
      page.getByRole("link", { name: "Download on osu!", exact: true }),
    ];
    for (const action of actions) {
      await expect(action).toBeVisible();
      await expect(action.locator("svg")).toHaveCount(1);
      await expect(action.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(action.locator("svg")).toHaveAttribute("focusable", "false");
      expect(await action.evaluate(element => {
        const icon = element.querySelector("svg")!.getBoundingClientRect();
        return icon.width === 18 && icon.height === 18 && element.scrollWidth <= element.clientWidth;
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320) await page.screenshot({ path: testInfo.outputPath("action-icons-mobile.png"), fullPage: true });
  });
}

test("owner cancellation and restored Stop/Unbookmark controls have icons", async ({ page }) => {
  const state = await setup(page, { engagement: { bookmarkCount: 3, isBookmarkedByCurrentUser: true } });
  state.ongoing = [hunt];
  await page.goto(`/bounties/${id}`);
  await expect(page.getByRole("button", { name: "Stop Hunting", exact: true }).locator("svg")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Unbookmark", exact: true }).locator("svg")).toHaveCount(1);
  state.bounty.creatorOsuUserId = 99;
  await page.reload();
  await expect(page.getByRole("button", { name: "Cancel bounty", exact: true }).locator("svg")).toHaveCount(1);
});
