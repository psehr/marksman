import type { BountyEvent, User } from "@marksman/contracts";
import { expect, test, type Page } from "@playwright/test";

const creator: User = {
  identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 42, username: "mapmaker" },
  stats: { bpBalance: 100 }, createdAt: "2026-01-01T00:00:00.000Z",
};
const winner: User = {
  ...creator,
  identity: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", osuUserId: 43, username: "scorehunter" },
};
function event(index: number, type: BountyEvent["type"] = "created"): BountyEvent {
  return {
    bountyId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    type, timestamp: "2026-01-02T12:00:00.000Z",
    creator: creator.identity, winner: type === "completed" ? winner.identity : null,
  };
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
const section = (page: Page) => page.getByRole("heading", { name: "Events history", exact: true }).locator("..");
const table = (page: Page) => section(page).getByRole("table", { name: "Bounty Events History" });
const next = (page: Page) => section(page).getByRole("button", { name: ">", exact: true });
const previous = (page: Page) => section(page).getByRole("button", { name: "<", exact: true });
const visit = (page: Page, user = creator) => page.goto(`/users/${user.identity.id}`);

async function setup(page: Page, account: User | null = null, authGate?: Promise<void>) {
  const state = { account, profileReads: 0, ledgerReads: 0, eventRequests: [] as string[] };
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:3100") return route.continue();
    return route.abort("blockedbyclient");
  });
  await page.route("**/auth/me", async route => {
    if (authGate) await authGate;
    return route.fulfill(state.account ? { json: state.account }
      : { status: 401, json: { error: "Not logged in" } });
  });
  await page.route("**/auth/logout", route => {
    state.account = null;
    return route.fulfill({ status: 204 });
  });
  await page.route("**/users/*", route => {
    if (new URL(route.request().url()).origin === "http://127.0.0.1:3100") return route.fallback();
    if (!["fetch", "xhr"].includes(route.request().resourceType())) return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const user = [creator, winner].find(user => user.identity.id === id);
    if (!user) return route.fallback();
    state.profileReads++;
    return route.fulfill({ json: user });
  });
  await page.route("**/users/me/ledger?*", route => {
    state.ledgerReads++;
    return route.fulfill({ json: [] });
  });
  await page.route("**/users/*/bounty-events?*", route => {
    const url = new URL(route.request().url());
    state.eventRequests.push(url.pathname + url.search);
    return route.fulfill({ json: url.pathname.includes(creator.identity.id)
      ? [event(1, "cancelled"), event(2, "completed"), event(2)] : [event(2, "completed")] });
  });
  return state;
}

for (const account of [null, winner]) {
  test(`${account ? "another signed-in player" : "signed-out visitor"} sees creator events and bounty links`, async ({ page }) => {
    const state = await setup(page, account);
    await visit(page);
    await expect(table(page).locator("tbody tr")).toHaveCount(3);
    await expect(section(page).getByText("Funded a new bounty", { exact: true })).toBeVisible();
    await expect(section(page).getByText("Cancelled a bounty", { exact: true })).toBeVisible();
    await expect(section(page).getByText("scorehunter completed mapmaker's bounty", { exact: true })).toBeVisible();
    await expect(table(page).getByRole("link").nth(0)).toHaveAttribute("href", `/bounties/${event(1).bountyId}`);
    await expect(table(page).getByRole("link").nth(1)).toHaveAttribute("href", `/bounties/${event(2).bountyId}`);
    await expect(table(page).locator("tbody tr").first()).toContainText("ago");
    expect(state.ledgerReads).toBe(0);
    await expect(page.getByRole("table", { name: "BP transaction history" })).toHaveCount(0);
  });
}

test("winner profile displays completion returned by the API", async ({ page }) => {
  await setup(page);
  await visit(page, winner);
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  await expect(table(page)).toContainText("scorehunter completed mapmaker's bounty");
  await expect(section(page).getByText("Funded a new bounty")).toHaveCount(0);
  await expect(section(page).getByText("Cancelled a bounty")).toHaveCount(0);
});

test("missing creator and winner identities render readable fallbacks", async ({ page }) => {
  await setup(page);
  await page.route("**/users/*/bounty-events?*", route => route.fulfill({
    json: [{ ...event(1, "completed"), creator: null, winner: null }],
  }));
  await visit(page);
  await expect(table(page)).toContainText("Unknown user completed Unknown user's bounty");
});

test("public history loads before authentication and persists after logout on page two", async ({ page }) => {
  const auth = gate();
  await setup(page, creator, auth.promise);
  const pages: number[] = [];
  await page.route("**/users/*/bounty-events?*", route => {
    const p = Number(new URL(route.request().url()).searchParams.get("page"));
    pages.push(p);
    return route.fulfill({ json: p === 1 ? Array.from({ length: 20 }, (_, i) => event(i + 1)) : [event(21, "cancelled")] });
  });
  try {
    await visit(page);
    await expect(table(page).locator("tbody tr")).toHaveCount(20);
    await next(page).click();
    await expect(section(page).getByText("Page 2", { exact: true })).toBeVisible();
  } finally { auth.release(); }
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Log in with osu!" })).toBeVisible();
  await expect(section(page).getByText("Page 2", { exact: true })).toBeVisible();
  await expect(table(page)).toContainText("Cancelled a bounty");
  expect(pages).toEqual([1, 2]);
});

test("pagination shows loading, short final page and Previous without reloading profile", async ({ page }) => {
  const state = await setup(page, creator);
  const pending = gate();
  const pages: number[] = [];
  await page.route("**/users/*/bounty-events?*", async route => {
    const p = Number(new URL(route.request().url()).searchParams.get("page"));
    pages.push(p);
    if (p === 2) await pending.promise;
    return route.fulfill({ json: p === 1 ? Array.from({ length: 20 }, (_, i) => event(i + 1)) : [event(21, "cancelled")] });
  });
  await visit(page);
  await expect(table(page).locator("tbody tr")).toHaveCount(20);
  const reads = state.profileReads;
  await next(page).click();
  try {
    await expect(section(page).getByText("Loading...", { exact: true })).toBeVisible();
    await expect(table(page)).toHaveCount(0);
  } finally { pending.release(); }
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
  await expect(section(page).getByText("Page 2", { exact: true })).toBeVisible();
  await expect(next(page)).toHaveCount(0);
  await previous(page).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(20);
  expect(state.profileReads).toBe(reads);
  expect(pages).toEqual([1, 2, 1]);
  // The owner's independently paginated ledger remains on its first page.
  expect(state.ledgerReads).toBe(1);
});

test("empty page after a full final page keeps Previous; empty first page has no navigation", async ({ page }) => {
  await setup(page);
  let empty = false;
  await page.route("**/users/*/bounty-events?*", route => route.fulfill({
    json: !empty && new URL(route.request().url()).searchParams.get("page") === "1"
      ? Array.from({ length: 20 }, (_, i) => event(i + 1)) : [],
  }));
  await visit(page);
  await next(page).click();
  await expect(section(page).getByText("[No events to show]", { exact: true })).toBeVisible();
  await expect(next(page)).toHaveCount(0);
  await previous(page).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(20);
  empty = true;
  await page.reload();
  await expect(section(page).getByText("[No events to show]", { exact: true })).toBeVisible();
  await expect(previous(page)).toHaveCount(0);
  await expect(next(page)).toHaveCount(0);
});

for (const failure of [400, 404, 500, "network"] as const) {
  test(`events ${failure} failure stays inline and Retry recovers`, async ({ page }) => {
    await setup(page);
    let attempts = 0;
    await page.route("**/users/*/bounty-events?*", route => {
      if (++attempts > 1) return route.fulfill({ json: [event(1)] });
      return failure === "network" ? route.abort("failed")
        : route.fulfill({ status: failure, json: { error: "Fixture failure" } });
    });
    await visit(page);
    await expect(section(page).getByText("Error loading events", { exact: true })).toBeVisible();
    await expect(page.getByText("Balance: 100 BP", { exact: true })).toBeVisible();
    await section(page).getByRole("button", { name: "Retry", exact: true }).click();
    await expect(table(page).locator("tbody tr")).toHaveCount(1);
    await expect(section(page).getByText("Error loading events")).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}

for (const lateStatus of [200, 500]) {
  test(`switching profiles resets page and ignores a late ${lateStatus} event response`, async ({ page }) => {
    await setup(page, winner);
    const pending = gate();
    let started = false;
    let finished = false;
    const winnerPages: number[] = [];
    await page.route("**/users/*/bounty-events?*", async route => {
      const url = new URL(route.request().url());
      const p = Number(url.searchParams.get("page"));
      if (url.pathname.includes(winner.identity.id)) {
        winnerPages.push(p);
        return route.fulfill({ json: [event(99, "completed")] });
      }
      if (p === 1) return route.fulfill({ json: Array.from({ length: 20 }, (_, i) => event(i + 1)) });
      started = true;
      await pending.promise;
      await route.fulfill({ status: lateStatus, json: lateStatus === 200 ? [event(21, "cancelled")] : { error: "Late failure" } });
      finished = true;
    });
    await visit(page);
    await next(page).click();
    try {
      await expect.poll(() => started).toBe(true);
      // A real Next Link transition preserves the mounted profile component.
      await page.getByRole("navigation").getByRole("link", { name: "Profile", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/users/${winner.identity.id}$`));
      await expect(table(page)).toContainText("scorehunter completed mapmaker's bounty");
    } finally { pending.release(); }
    await expect.poll(() => finished).toBe(true);
    await expect(section(page).getByText("Page 1", { exact: true })).toBeVisible();
    await expect(table(page).locator("tbody tr")).toHaveCount(1);
    await expect(table(page).getByRole("link")).toHaveAttribute("href", `/bounties/${event(99).bountyId}`);
    await expect(section(page).getByText("Cancelled a bounty")).toHaveCount(0);
    await expect(section(page).getByText("Error loading events")).toHaveCount(0);
    expect(winnerPages).toEqual([1]);
  });
}

test("malformed events response stays inline and Retry restores valid history", async ({ page }) => {
  await setup(page);
  let reads = 0;
  await page.route("**/users/*/bounty-events?*", route => route.fulfill({ json: ++reads === 1 ? [{}] : [event(1)] }));
  await visit(page);
  await expect(page.getByText("Error loading events", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(table(page).locator("tbody tr")).toHaveCount(1);
});
