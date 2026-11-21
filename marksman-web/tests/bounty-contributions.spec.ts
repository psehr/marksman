import { mockAvatars } from "./fixtures/avatars";
import { expect, test, type Page, type Route } from "@playwright/test";

test.beforeEach(async ({ page }) => mockAvatars(page));
import { MAX_BOUNTY_REWARD_BP, type ExtendedBounty, type User } from "@marksman/contracts";

const user: User = {
  identity: { id: "12345678-1234-4234-8234-123456789abc", osuUserId: 123, username: "funder" },
  stats: { bpBalance: 1000 }, createdAt: "2026-01-01T00:00:00.000Z",
};
const bounty: ExtendedBounty = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "open", rewardBp: 100,
  creatorOsuUserId: 123, createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: null, cancelledAt: null, completedByOsuUserId: null, completionScoreId: null,
  goal: { type: "pass", beatmapId: 42, beatmapChecksum: null, modRequirement: { rule: "any" } },
  owner: null, winner: null, beatmap: null,
  engagement: { hunterCount: 0, bookmarkCount: 0, isBookmarkedByCurrentUser: false },
};
type Input = { amountBp: number; idempotencyKey: string };

async function setup(page: Page, options: { owner?: boolean; closed?: boolean; reward?: number } = {}) {
  const state = {
    bounty: { ...bounty, creatorOsuUserId: options.owner === false ? 456 : 123,
      status: options.closed ? "cancelled" : "open", rewardBp: options.reward ?? 100 },
    balance: 1000, reads: 0, accounts: 0, failBounty: false, failBalance: false,
    posts: [] as Input[],
  };
  await page.route("**/auth/me", route => {
    state.accounts++;
    return state.failBalance ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: { ...user, stats: { bpBalance: state.balance } } });
  });
  await page.route("**/auth/access", route => route.fulfill({ status: 204 }));
  await page.route("**/users/me/hunts", route => route.fulfill({ json: [] }));
  await page.route(`**/bounties/${bounty.id}`, route => {
    if (route.request().isNavigationRequest() || route.request().headers().rsc) return route.fallback();
    state.reads++;
    return state.failBounty ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: state.bounty });
  });
  return state;
}
async function openForm(page: Page) {
  await page.goto(`/bounties/${bounty.id}`);
  await page.getByRole("button", { name: "Fund bounty", exact: true }).click();
}
async function respond(route: Route, input: Input) {
  return route.fulfill({ json: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", bountyId: bounty.id,
    userId: user.identity.id, amountBp: input.amountBp, feeBp: Math.ceil(input.amountBp / 10),
    createdAt: "2026-11-17T12:00:00.000Z",
  } });
}

for (const owner of [true, false]) {
  test(`${owner ? "creator" : "hunter"} can fund, previews rounding, refreshes server reward and balance`, async ({ page }) => {
    const state = await setup(page, { owner });
    await page.route(`**/bounties/${bounty.id}/contributions`, async route => {
      const input = route.request().postDataJSON() as Input;
      state.posts.push(input);
      state.bounty.rewardBp = 777; // Includes another user's concurrent funding.
      state.balance = 987;
      await respond(route, input);
    });
    await openForm(page);
    const field = page.getByLabel("Contribution (BP)");
    await field.fill("11");
    await expect(page.locator("#contribution-cost")).toHaveText("Contribution: 11 BP · Fee: 2 BP · Total debit: 13 BP");
    await page.getByRole("button", { name: "Confirm contribution" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 11 BP" })).toBeVisible();
    await expect(page.getByText("777", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByLabel("Your BP balance")).toHaveText("987");
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Add another contribution" }).click();
    await expect(page.getByText(/Balance: 987 BP/)).toBeVisible();
    await field.fill("10");
    await page.getByRole("button", { name: "Confirm contribution" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 10 BP" })).toBeVisible();
    expect(state.posts[1].idempotencyKey).not.toBe(state.posts[0].idempotencyKey);
  });
}

test("validates amount, fee-inclusive balance and remaining cap without POST", async ({ page }) => {
  const state = await setup(page, { reward: MAX_BOUNTY_REWARD_BP - 10 });
  await page.route("**/contributions", route => { state.posts.push(route.request().postDataJSON()); return route.abort(); });
  await openForm(page);
  const confirm = page.getByRole("button", { name: "Confirm contribution" });
  const field = page.getByLabel("Contribution (BP)");
  for (const value of ["", "0", "-1", "1.5", "11"]) {
    await field.fill(value);
    await expect(confirm).toBeDisabled();
  }
  await field.fill("10");
  await expect(confirm).toBeEnabled();
  expect(state.posts).toHaveLength(0);
});

test("blocks amounts whose fee exceeds available balance", async ({ page }) => {
  await setup(page);
  await openForm(page);
  await page.getByLabel("Contribution (BP)").fill("1000");
  await expect(page.getByText("You don't have enough BP to cover the contribution and fee.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm contribution" })).toBeDisabled();
});

for (const failure of ["network", "http"] as const) {
  test(`${failure} retry reuses key, locks pending and preserves other actions`, async ({ page }) => {
    const state = await setup(page, { owner: false });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/bounties/${bounty.id}/contributions`, async route => {
      const input = route.request().postDataJSON() as Input;
      state.posts.push(input);
      if (state.posts.length === 1) return failure === "network" ? route.abort("failed")
        : route.fulfill({ status: 409, json: { code: "INSUFFICIENT_BP", error: "Insufficient BP" } });
      await gate;
      await respond(route, input);
    });
    await openForm(page);
    await page.getByLabel("Contribution (BP)").fill("10");
    await page.getByRole("button", { name: "Confirm contribution" }).click();
    await expect(page.locator("form [role=alert]")).toBeVisible();
    await page.getByRole("button", { name: "Retry contribution" }).click();
    try {
      const pending = page.getByRole("button", { name: "Saving...", exact: true });
      await expect(pending).toBeDisabled();
      await pending.evaluate((button: HTMLButtonElement) => button.click());
      await expect(page.getByLabel("Contribution (BP)")).toBeDisabled();
      await expect(page.getByRole("button", { name: "Bookmark", exact: true })).toBeEnabled();
      expect(state.posts).toHaveLength(2);
      expect(state.posts[1]).toEqual(state.posts[0]);
    } finally { release(); }
    await expect(page.getByRole("status").filter({ hasText: "Added 10 BP" })).toBeVisible();
  });
}

test("editing amount after failure creates a new intended contribution key", async ({ page }) => {
  const state = await setup(page);
  await page.route(`**/bounties/${bounty.id}/contributions`, async route => {
    const input = route.request().postDataJSON() as Input;
    state.posts.push(input);
    if (state.posts.length === 1) return route.fulfill({ status: 409, json: { error: "Insufficient BP" } });
    return respond(route, input);
  });
  await openForm(page);
  await page.getByLabel("Contribution (BP)").fill("20");
  await page.getByRole("button", { name: "Confirm contribution" }).click();
  await expect(page.locator("form [role=alert]")).toBeVisible();
  await page.getByLabel("Contribution (BP)").fill("10");
  await page.getByRole("button", { name: "Confirm contribution" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added 10 BP" })).toBeVisible();
  expect(state.posts[1].idempotencyKey).not.toBe(state.posts[0].idempotencyKey);
});

for (const target of ["bounty", "balance"] as const) {
  test(`successful debit with failed ${target} refresh retries reads without another POST`, async ({ page }) => {
    const state = await setup(page);
    await page.route(`**/bounties/${bounty.id}/contributions`, async route => {
      const input = route.request().postDataJSON() as Input;
      state.posts.push(input);
      state.bounty.rewardBp = 110;
      state.balance = 989;
      if (target === "bounty") state.failBounty = true;
      else state.failBalance = true;
      await respond(route, input);
    });
    await openForm(page);
    await page.getByLabel("Contribution (BP)").fill("10");
    await page.getByRole("button", { name: "Confirm contribution" }).click();
    await expect(page.locator("form [role=alert]")).toContainText("Contribution saved");
    await expect(page.getByLabel("Contribution (BP)")).toBeDisabled();
    state.failBounty = state.failBalance = false;
    await page.getByRole("button", { name: "Retry refresh" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 10 BP" })).toBeVisible();
    expect(state.posts).toHaveLength(1);
  });
}

test("closed bounty has no new funding action", async ({ page }) => {
  await setup(page, { closed: true });
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fund bounty", exact: true })).toHaveCount(0);
});

test("full reward disables funding", async ({ page }) => {
  await setup(page, { reward: MAX_BOUNTY_REWARD_BP });
  await page.goto(`/bounties/${bounty.id}`);
  await expect(page.getByRole("button", { name: "Reward limit reached" })).toBeDisabled();
});

for (const owner of [true, false]) {
  test(`uncertain contribution can replay after polling observes closure for ${owner ? "creator" : "hunter"}`, async ({ page }) => {
    const state = await setup(page, { owner });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.route(`**/bounties/${bounty.id}/contributions`, async route => {
      const input = route.request().postDataJSON() as Input;
      state.posts.push(input);
      if (state.posts.length === 1) {
        state.bounty.status = "completed";
        state.bounty.rewardBp = 110;
        state.balance = 0;
        return route.abort("failed"); // Server committed, response was lost.
      }
      return respond(route, input);
    });
    await openForm(page);
    await page.getByLabel("Contribution (BP)").fill("10");
    await page.getByRole("button", { name: "Confirm contribution" }).click();
    await expect(page.locator("form [role=alert]")).toBeVisible();
    await page.clock.runFor(5000);
    await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry contribution" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 10 BP" })).toBeVisible();
    expect(state.posts).toHaveLength(2);
    expect(state.posts[1]).toEqual(state.posts[0]);
  });

}

test("an older polling response cannot overwrite the refreshed reward", async ({ page }) => {
  const state = await setup(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let held = false;
  let returned = false;
  await page.route(`**/bounties/${bounty.id}`, async route => {
    if (route.request().isNavigationRequest() || route.request().headers().rsc) return route.fallback();
    state.reads++;
    const snapshot = { ...state.bounty };
    if (state.reads === 2) {
      held = true;
      await gate;
      returned = true;
    }
    await route.fulfill({ json: snapshot });
  });
  await page.route(`**/bounties/${bounty.id}/contributions`, async route => {
    state.bounty.rewardBp = 777;
    await respond(route, route.request().postDataJSON());
  });
  await openForm(page);
  await page.clock.runFor(5000);
  await expect.poll(() => held).toBe(true);
  try {
    await page.getByLabel("Contribution (BP)").fill("10");
    await page.getByRole("button", { name: "Confirm contribution" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 10 BP" })).toBeVisible();
    await expect(page.getByText("777", { exact: true })).toBeVisible();
  } finally { release(); }
  await expect.poll(() => returned).toBe(true);
  // Let the browser consume the older HTTP response before checking the display.
  await page.evaluate(() => new Promise<void>(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  }));
  await expect(page.getByText("777", { exact: true })).toBeVisible();
});

for (const owner of [true, false]) {
  for (const width of [320, 640, 1280]) {
    test(`funding action uses grid width before share at ${width}px for ${owner ? "creator" : "hunter"}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page, { owner });
      await page.goto(`/bounties/${bounty.id}`);
      const fund = page.getByRole("button", { name: "Fund bounty", exact: true });
      const share = page.getByRole("button", { name: "Share bounty", exact: true });
      await expect(fund).toBeVisible();
      await expect(share).toBeVisible();
      expect(await share.evaluate(el => el.parentElement!.previousElementSibling?.textContent)).toBe("Fund bounty");
      const fundBox = (await fund.boundingBox())!;
      const shareBox = (await share.boundingBox())!;
      expect(Math.abs(fundBox.width - shareBox.width)).toBeLessThan(2);
      expect(Math.abs(fundBox.height - shareBox.height)).toBeLessThan(2);
      expect(await fund.evaluate(el => getComputedStyle(el.parentElement!).display)).toBe("grid");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const hunt = owner ? null : await page.getByRole("button", { name: "Start Hunting", exact: true }).elementHandle();
      await fund.click();
      await expect(page.getByLabel("Contribution (BP)")).toBeVisible();
      const formBox = (await page.locator("form").boundingBox())!;
      if (width >= 640) expect(formBox.width).toBeGreaterThan(shareBox.width);
      if (hunt) expect(await hunt.evaluate(el => el.isConnected)).toBe(true);
    });
  }
}
