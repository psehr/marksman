import { expect, test, type Page, type Route } from "@playwright/test";

const user = {
  identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 123, username: "daily_fixture" },
  stats: { bpBalance: 100 }, createdAt: "2026-01-01T00:00:00.000Z",
};
async function setup(page: Page, options: { claimed?: boolean; failure?: boolean; owner?: boolean; hold?: boolean; conflict?: boolean } = {}) {
  const state = { claimed: options.claimed ?? false, failure: options.failure ?? false, reads: 0, posts: 0, pending: undefined as Route | undefined };
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:3100") return route.continue();
    if (url.pathname === "/auth/me") return route.fulfill({ json: user });
    if (url.pathname === "/auth/access") return route.fulfill({ status: 204 });
    if (url.pathname === "/economy/daily-claim") {
      if (request.method() === "POST") {
        state.posts++;
        state.claimed = true;
        return route.fulfill(options.conflict
          ? { status: 409, json: { code: "DAILY_ALREADY_CLAIMED", error: "Already claimed" } }
          : { json: { message: "Claimed" } });
      }
      state.reads++;
      if (options.hold) { state.pending = route; return; }
      if (state.failure) return route.fulfill({ status: 500, json: {} });
      return route.fulfill({ json: state.claimed
        ? { claimedToday: true, nextClaimAt: "2026-11-11T00:00:00.000Z" }
        : { claimedToday: false } });
    }
    if (/\/users\/[^/]+$/.test(url.pathname)) {
      return route.fulfill({ json: { ...user, identity: { ...user.identity, id: url.pathname.split("/").pop() }, stats: { bpBalance: state.claimed ? 125 : 100, bountiesWon: 0, bountyEarningsBp: 0 } } });
    }
    if (/\/(hunts|ledger|bounty-events)$/.test(url.pathname)) return route.fulfill({ json: [] });
    return route.abort();
  });
  const id = options.owner === false ? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" : user.identity.id;
  await page.goto(`/users/${id}`);
  return state;
}

test("already claimed remains disabled after reload", async ({ page }) => {
  const state = await setup(page, { claimed: true });
  await expect(page.getByRole("button", { name: "Daily BP claimed" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Daily BP claimed" })).toBeDisabled();
  expect(state.reads).toBeGreaterThanOrEqual(2);
  expect(state.posts).toBe(0);
});

test("claim status loading blocks submission", async ({ page }) => {
  const state = await setup(page, { hold: true });
  await expect(page.getByRole("button", { name: "Checking daily BP…" })).toBeDisabled();
  await expect.poll(() => !!state.pending).toBe(true);
  expect(state.posts).toBe(0);
  await state.pending!.fulfill({ json: { claimedToday: false } });
  await expect(page.getByRole("button", { name: "Claim daily 25 BP" })).toBeEnabled();
});

for (const conflict of [false, true]) {
  test(`${conflict ? "409" : "success"} disables claim and survives page refresh`, async ({ page }) => {
    const state = await setup(page, { conflict });
    await page.getByRole("button", { name: "Claim daily 25 BP" }).click();
    await expect(page.getByRole("button", { name: "Daily BP claimed" })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("button", { name: "Daily BP claimed" })).toBeDisabled();
    expect(state.posts).toBe(1);
  });
}

test("status failure blocks claim and read-only retry recovers", async ({ page }) => {
  const state = await setup(page, { failure: true });
  await expect(page.getByRole("alert").filter({ hasText: "Could not check your daily reward." })).toHaveText("Could not check your daily reward.");
  await expect(page.getByRole("button", { name: "Claim daily 25 BP" })).toBeDisabled();
  state.failure = false;
  await page.getByRole("button", { name: "Retry daily status" }).click();
  await expect(page.getByRole("button", { name: "Claim daily 25 BP" })).toBeEnabled();
  expect(state.posts).toBe(0);
});

test("other profiles do not load private claim status", async ({ page }) => {
  const state = await setup(page, { owner: false });
  await expect(page.getByText("daily_fixture", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /daily.*BP|Daily BP/ })).toHaveCount(0);
  expect(state.reads).toBe(0);
});

test("UTC reset rechecks status and enables the next day's claim", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-10T23:59:50.000Z") });
  const state = await setup(page, { claimed: true });
  await expect(page.getByRole("button", { name: "Daily BP claimed" })).toBeDisabled();
  state.claimed = false;
  await page.clock.fastForward(11_000);
  await expect(page.getByRole("button", { name: "Claim daily 25 BP" })).toBeEnabled();
  expect(state.reads).toBe(2);
});
