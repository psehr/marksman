import type { LedgerEntry, User } from "@marksman/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

const owner: User = {
  identity: { id: "12345678-1234-4234-8234-123456789abc", osuUserId: 42, username: "ledger-owner" },
  stats: { bpBalance: 100 },
  createdAt: "2026-01-01T00:00:00.000Z",
};
const other: User = {
  ...owner,
  identity: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", osuUserId: 43, username: "other-player" },
};
const bountyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function entry(index: number, reason: LedgerEntry["reason"] = "daily_claim"): LedgerEntry {
  return {
    id: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    userId: owner.identity.id, amount: reason === "bounty_fee" ? -3 : 25,
    reason, bountyId: reason === "bounty_fee" ? bountyId : null,
    createdAt: "2026-01-02T12:00:00.000Z",
  };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function setup(page: Page, account: User | null = owner, authGate?: Promise<void>) {
  const state = { account, balance: 100, accountReads: 0, profileReads: 0, ledgerPages: [] as number[] };
  // All external requests are blocked unless a mock below handles them.
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:3100") return route.continue();
    return route.abort("blockedbyclient");
  });
  await page.route("**/auth/me", async route => {
    state.accountReads++;
    if (authGate) await authGate;
    return route.fulfill(state.account
      ? { json: { ...state.account, stats: { bpBalance: state.balance } } }
      : { status: 401, json: { code: "NOT_LOGGED_IN", error: "Not logged in" } });
  });
  await page.route("**/users/*", route => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:3100") return route.fallback();
    if (route.request().isNavigationRequest() || !["fetch", "xhr"].includes(route.request().resourceType())) return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").pop();
    if (id !== owner.identity.id && id !== other.identity.id) return route.fallback();
    state.profileReads++;
    return route.fulfill({ json: { ...(id === owner.identity.id ? owner : other), stats: { bpBalance: state.balance } } });
  });
  await page.route("**/users/me/ledger?*", route => {
    state.ledgerPages.push(Number(new URL(route.request().url()).searchParams.get("page")));
    return route.fulfill({ json: [entry(1)] });
  });
  await page.route("**/users/*/bounty-events?*", route => route.fulfill({ json: [] }));
  return state;
}
const visit = (page: Page) => page.goto(`/users/${owner.identity.id}`);
const history = (page: Page) => page.getByRole("heading", { name: "Transactions", exact: true });
const next = (page: Page) => page.getByRole("button", { name: ">", exact: true });
const previous = (page: Page) => page.getByRole("button", { name: "<", exact: true });

test("late authentication starts owner history; renders signed amounts and bounty links", async ({ page }) => {
  const auth = gate();
  const state = await setup(page, owner, auth.promise);
  await page.route("**/users/me/ledger?*", route => {
    state.ledgerPages.push(1);
    return route.fulfill({ json: [entry(1), entry(2, "bounty_fee")] });
  });
  try {
    await visit(page);
    await expect(page.getByText("Balance: 100 BP", { exact: true })).toBeVisible();
    expect(state.ledgerPages).toEqual([]);
    await expect(history(page)).toHaveCount(0);
  } finally { auth.release(); }
  await expect(history(page)).toBeVisible();
  await expect(page.getByRole("cell", { name: "+25", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "-3", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bounty Funding Fee" })).toHaveAttribute("href", `/bounties/${bountyId}`);
});

for (const account of [null, other]) {
  test(`${account ? "nonowner" : "signed-out visitor"} never requests private history`, async ({ page }) => {
    const state = await setup(page, account);
    await visit(page);
    await expect(page.getByText("Balance: 100 BP", { exact: true })).toBeVisible();
    await expect(account
      ? page.getByRole("button", { name: "Log out", exact: true }).first()
      : page.getByRole("link", { name: "Log in with osu!", exact: true })).toBeVisible();
    await expect(history(page)).toHaveCount(0);
    expect(state.ledgerPages).toEqual([]);
  });
}

test("pagination shows loading, short final page and Previous without reloading profile", async ({ page }) => {
  const state = await setup(page);
  const pending = gate();
  let requested = false;
  await page.route("**/users/me/ledger?*", async route => {
    const p = Number(new URL(route.request().url()).searchParams.get("page"));
    state.ledgerPages.push(p);
    if (p === 2) { requested = true; await pending.promise; }
    return route.fulfill({ json: p === 1 ? Array.from({ length: 20 }, (_, i) => entry(i + 1)) : [entry(21, "bounty_fee")] });
  });
  await visit(page);
  await expect(page.locator("tbody tr")).toHaveCount(20);
  const reads = state.profileReads;
  await next(page).click();
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(history(page)).toBeVisible();
    await expect(page.getByText("Loading...", { exact: true })).toBeVisible();
  } finally { pending.release(); }
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(next(page)).toHaveCount(0);
  await previous(page).click();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  expect(state.profileReads).toBe(reads);
  expect(state.ledgerPages).toEqual([1, 2, 1]);
});

test("empty page after a full final page allows returning; empty first page has no navigation", async ({ page }) => {
  await setup(page);
  let empty = false;
  await page.route("**/users/me/ledger?*", route => route.fulfill({
    json: !empty && new URL(route.request().url()).searchParams.get("page") === "1"
      ? Array.from({ length: 20 }, (_, i) => entry(i + 1)) : [],
  }));
  await visit(page);
  await next(page).click();
  await expect(page.getByText("[No transactions to show]", { exact: true })).toBeVisible();
  await expect(next(page)).toHaveCount(0);
  await previous(page).click();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  empty = true;
  await page.reload();
  await expect(page.getByText("[No transactions to show]", { exact: true })).toBeVisible();
  await expect(previous(page)).toHaveCount(0);
  await expect(next(page)).toHaveCount(0);
});

for (const failure of [400, 404, 500, "network"] as const) {
  test(`ledger ${failure} failure stays inline and Retry recovers`, async ({ page }) => {
    await setup(page);
    let attempts = 0;
    await page.route("**/users/me/ledger?*", route => {
      if (++attempts > 1) return route.fulfill({ json: [entry(1)] });
      return failure === "network" ? route.abort("failed") : route.fulfill({ status: failure, json: { error: "Fixture failure" } });
    });
    await visit(page);
    await expect(page.getByText("Error loading ledger", { exact: true })).toBeVisible();
    await expect(history(page)).toBeVisible();
    await expect(page.getByText("Balance: 100 BP", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByText("Error loading ledger", { exact: true })).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}

test("daily claim from page two refreshes balance and account and returns history to page one", async ({ page }) => {
  const state = await setup(page);
  let claimed = false;
  await page.route("**/users/me/ledger?*", route => {
    const p = Number(new URL(route.request().url()).searchParams.get("page"));
    state.ledgerPages.push(p);
    return route.fulfill({ json: p === 1
      ? (claimed ? [entry(99)] : Array.from({ length: 20 }, (_, i) => entry(i + 1, "bounty_fee")))
      : [entry(21, "bounty_fee")] });
  });
  await page.route("**/economy/daily-claim", route => {
    expect(route.request().method()).toBe("POST");
    claimed = true;
    state.balance = 125;
    return route.fulfill({ json: { message: "Daily reward claimed." } });
  });
  await visit(page);
  await next(page).click();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  const reads = state.accountReads;
  await page.getByRole("button", { name: "Claim daily 25 BP", exact: true }).click();
  await expect(page.getByText("Claimed 25 BP.", { exact: true })).toBeVisible();
  await expect(page.getByText("Balance: 125 BP", { exact: true })).toBeVisible();
  await expect(history(page).locator("..").getByText("Page 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "+25", exact: true })).toBeVisible();
  expect(state.accountReads).toBeGreaterThan(reads);
});

for (const lateStatus of [200, 500]) {
  test(`logout ignores a late ledger ${lateStatus} response and hides private history`, async ({ page }) => {
    const state = await setup(page);
    const pending = gate();
    let started = false;
    let finished = false;
    await page.route("**/users/me/ledger?*", async (route: Route) => {
      started = true;
      await pending.promise;
      await route.fulfill({ status: lateStatus, json: lateStatus === 200 ? [entry(1)] : { error: "late" } });
      finished = true;
    });
    await page.route("**/auth/logout", route => {
      state.account = null;
      return route.fulfill({ status: 204 });
    });
    await visit(page);
    try {
      await expect.poll(() => started).toBe(true);
      await page.getByRole("button", { name: "Log out", exact: true }).first().click();
      await expect(page.getByRole("link", { name: "Log in with osu!" })).toBeVisible();
    } finally { pending.release(); }
    await expect.poll(() => finished).toBe(true);
    await expect(history(page)).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText("Error loading ledger", { exact: true })).toHaveCount(0);
  });
}

for (const status of [400, 404, 500, "schema"] as const) {
  test(`profile ${status} response shows the appropriate error`, async ({ page }) => {
    await setup(page);
    await page.route(`**/users/${owner.identity.id}`, route => {
      if (route.request().isNavigationRequest()) return route.fallback();
      return route.fulfill({ status: status === "schema" ? 200 : status, json: {} });
    });
    await visit(page);
    if (status === 400 || status === 404) {
      await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("500 Internal Error", { exact: true })).toBeVisible();
    }
  });
}

test("malformed ledger response stays inline and Retry restores valid entries", async ({ page }) => {
  await setup(page);
  let reads = 0;
  await page.route("**/users/me/ledger?*", route => route.fulfill({ json: ++reads === 1 ? [{}] : [entry(1)] }));
  await visit(page);
  await expect(page.getByText("Error loading ledger", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("cell", { name: "+25", exact: true })).toBeVisible();
});

for (const failure of ["network", "http", "already-claimed"] as const) {
  test(`daily claim handles ${failure} and releases pending state`, async ({ page }) => {
    await setup(page);
    let attempts = 0;
    const pending = gate();
    await page.route("**/economy/daily-claim", async route => {
      attempts++;
      await pending.promise;
      if (attempts > 1) return route.fulfill({ json: { message: "Daily reward claimed." } });
      if (failure === "network") return route.abort("failed");
      return route.fulfill({ status: failure === "http" ? 500 : 409, json: { error: "Fixture claim failure" } });
    });
    await visit(page);
    await page.getByRole("button", { name: "Claim daily 25 BP", exact: true }).click();
    try {
      await expect.poll(() => attempts).toBe(1);
      await expect(page.getByRole("button", { name: "Claiming…", exact: true })).toBeDisabled();
    } finally { pending.release(); }
    if (failure === "already-claimed") {
      await expect(page.getByText("Already claimed today. Daily rewards reset at 00:00 UTC.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Daily BP claimed", exact: true })).toBeDisabled();
    } else {
      await expect(page.getByRole("alert").filter({ hasText: /Fixture claim failure|Could not claim/ })).toHaveText(failure === "http"
        ? "Fixture claim failure" : "Could not claim the daily reward. Please try again.");
      await page.getByRole("button", { name: "Claim daily 25 BP", exact: true }).click();
      await expect(page.getByText("Claimed 25 BP.", { exact: true })).toBeVisible();
      expect(attempts).toBe(2);
    }
  });
}
