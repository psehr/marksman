import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, afterEach, mock, test } from "node:test";
import { ledgerEntrySchema } from "@marksman/contracts";
import { bounties, ledgerEntries, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { qualifyingBounty } from "./fixtures/completion";

// Configure the isolated database before importing the application/pool.
Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_ledger_history_tests&options=-c%20statement_timeout%3D10000",
  FRONTEND_URL: "http://localhost:3000/", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { app } = require("../src/app") as typeof import("../src/app");
const { sessionStore } = require("../src/db/session-store") as typeof import("../src/db/session-store");
const testDatabase = createTestDatabase(db, true);
const httpFetch = globalThis.fetch;
let server: Server | undefined;
let baseUrl: string;
let alice: typeof users.$inferSelect;
let bob: typeof users.$inferSelect;
let creator: typeof users.$inferSelect;

let upstreamCalls: string[] = [];


before(async () => {
  await testDatabase.prepare();
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    upstreamCalls.push(url);
    throw new Error(`Unexpected fetch: ${url}; live requests are disabled`);
  });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await testDatabase.clear();
  upstreamCalls = [];

  [alice, bob, creator] = await db.insert(users).values([
    { osuUserId: 42, username: "alice" },
    { osuUserId: 43, username: "bob" },
    { osuUserId: 7, username: "creator" },
  ]).returning();
});

after(async () => {
  try {
    if (server) await new Promise<void>((resolve, reject) => {
      server!.close(error => error ? reject(error) : resolve());
      server!.closeAllConnections();
    });
    sessionStore.close();
    await testDatabase.clearIfMigrated();
  } finally {
    mock.restoreAll();
    await db.$client.end();
  }
});

async function cookieFor(userId: string) {
  const sid = randomUUID();
  const expire = new Date(Date.now() + 60_000);
  await db.insert(sessions).values({ sid, expire, sess: {
    cookie: { originalMaxAge: 60_000, expires: expire.toISOString(), httpOnly: true, path: "/", sameSite: "lax" },
    userId,
  } });
  const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(sid).digest("base64").replace(/=+$/, "");
  return `marksman.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}


async function request(userId?: string, query = "") {
  return httpFetch(`${baseUrl}/users/me/ledger${query}`, {
    headers: userId ? { Cookie: await cookieFor(userId) } : {},
  });
}

async function readEntries(response: Response) {
  assert.equal(response.status, 200);
  return ledgerEntrySchema.array().parse(await response.json());
}

afterEach(() => {
  assert.deepEqual(upstreamCalls, [], "Ledger history must not call osu!");
});

async function seedEntries(userId: string, count: number) {
  // Deliberately tied timestamps cross page boundaries; UUIDs break the ties.
  return db.insert(ledgerEntries).values(Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`,
    userId,
    amount: 25,
    reason: "daily_claim" as const,
    createdAt: new Date(index < 30 ? "2026-10-01T12:00:00Z" : "2026-10-02T12:00:00Z"),
  }))).returning();
}

test("ledger requires authentication", async () => {
  const response = await request();
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { code: "NOT_LOGGED_IN", error: "Not logged in" });
});

test("ledger is empty when only another user has entries", async () => {
  await seedEntries(bob.id, 3);
  assert.deepEqual(await readEntries(await request(alice.id)), []);
});

test("ledger uses authenticated identity and ignores supplied user IDs", async () => {
  const [aliceEntry, bobEntry] = await db.insert(ledgerEntries).values([
    { userId: alice.id, amount: 330, reason: "initial_grant" },
    { userId: bob.id, amount: 25, reason: "daily_claim" },
  ]).returning();
  const entries = await readEntries(await request(alice.id, `?userId=${bob.id}&osuUserId=${bob.osuUserId}`));
  assert.deepEqual(entries.map(e => e.id), [aliceEntry.id]);
  assert.equal(entries[0].userId, alice.id);
  assert.deepEqual((await readEntries(await request(bob.id))).map(e => e.id), [bobEntry.id]);
});

test("default page and pages 1 through 3 preserve ordering, limits and tied timestamps", async () => {
  const rows = await seedEntries(alice.id, 45);
  const expected = [...rows].sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
  const defaultPage = await readEntries(await request(alice.id));
  const pages = [];
  for (const page of [1, 2, 3]) {
    const entries = await readEntries(await request(alice.id, `?page=${page}`));
    assert.deepEqual(entries.map(e => e.id), expected.slice((page - 1) * 20, page * 20).map(e => e.id));
    pages.push(entries);
  }
  assert.deepEqual(defaultPage, pages[0]);
  assert.deepEqual(pages.map(p => p.length), [20, 20, 5]);
  assert.equal(new Set(pages.flat().map(e => e.id)).size, 45);
  assert.deepEqual(await readEntries(await request(alice.id, "?page=4")), []);
});

for (const value of ["0", "-1", "1.5", "abc", "", "Infinity", "NaN", "9007199254740992"]) {
  test(`ledger rejects invalid page ${JSON.stringify(value)}`, async () => {
    const response = await request(alice.id, `?page=${encodeURIComponent(value)}`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      code: "MALFORMED_PAGE_INDEX", error: "Malformed page index provided.",
    });
  });
}

test("ledger serializes all current reasons, amounts, timestamps and bounty links without mutations", async () => {
  const [bounty] = await db.insert(bounties).values({
    status: "open", rewardBp: 25, creatorOsuUserId: creator.osuUserId,
    goal: qualifyingBounty().goal,
  }).returning();
  const createdAt = new Date("2026-10-07T12:34:56.789Z");
  const rows = await db.insert(ledgerEntries).values([
    { userId: alice.id, amount: 330, reason: "initial_grant" as const, createdAt },
    { userId: alice.id, amount: 25, reason: "daily_claim" as const, createdAt },
    { userId: alice.id, amount: -25, reason: "bounty_funding" as const, bountyId: bounty.id, createdAt },
    { userId: alice.id, amount: -3, reason: "bounty_fee" as const, bountyId: bounty.id, createdAt },
    { userId: alice.id, amount: 25, reason: "bounty_refund" as const, bountyId: bounty.id, createdAt },
    { userId: alice.id, amount: 25, reason: "bounty_reward" as const, bountyId: bounty.id, createdAt },
  ]).returning();
  const snapshot = async () => ({
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  });
  const original = await snapshot();
  const entries = await readEntries(await request(alice.id));
  assert.deepEqual(entries, rows.sort((a, b) => b.id.localeCompare(a.id)).map(row => ({
    ...row, createdAt: row.createdAt.toISOString(),
  })));
  assert.deepEqual(await snapshot(), original);
});
