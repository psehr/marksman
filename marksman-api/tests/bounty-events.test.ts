import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, afterEach, mock, test } from "node:test";
import { bountyEventSchema } from "@marksman/contracts";
import { bounties, ledgerEntries, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { qualifyingBounty } from "./fixtures/completion";

// Configure the isolated database before importing the application/pool.
Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_bounty_events_tests&options=-c%20statement_timeout%3D10000",
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


async function request(profileId = alice.id, query = "", viewerId?: string) {
  return httpFetch(`${baseUrl}/users/${profileId}/bounty-events${query}`, {
    headers: viewerId ? { Cookie: await cookieFor(viewerId) } : {},
  });
}

async function readEvents(response: Response) {
  assert.equal(response.status, 200);
  return bountyEventSchema.array().parse(await response.json());
}

afterEach(() => {
  assert.deepEqual(upstreamCalls, [], "Bounty history must not call osu!");
});

const createdAt = new Date("2026-10-01T12:34:56.789Z");
const completedAt = new Date("2026-10-02T12:34:56.789Z");
const cancelledAt = new Date("2026-10-03T12:34:56.789Z");

async function seedBounty(overrides: Partial<typeof bounties.$inferInsert> = {}) {
  const [row] = await db.insert(bounties).values({
    status: "open", rewardBp: 25, creatorOsuUserId: alice.osuUserId,
    goal: qualifyingBounty().goal, createdAt, ...overrides,
  }).returning();
  return row;
}

function identity(user: typeof users.$inferSelect) {
  return { id: user.id, osuUserId: user.osuUserId, username: user.username };
}

test("history is public and uses the requested profile regardless of session or supplied identity", async () => {
  const row = await seedBounty();
  await seedBounty({ creatorOsuUserId: bob.osuUserId });
  const expected = [{ type: "created", timestamp: createdAt.toISOString(),
    bountyId: row.id, creator: identity(alice), winner: null }];
  assert.deepEqual(await readEvents(await request()), expected);
  assert.deepEqual(await readEvents(await request(alice.id,
    `?userId=${bob.id}&osuUserId=${bob.osuUserId}`, bob.id)), expected);
});

test("creation and cancellation belong to the creator; completion belongs to creator and winner", async () => {
  const completed = await seedBounty({ status: "completed", completedAt,
    completedByOsuUserId: bob.osuUserId, completionScoreId: 123 });
  const cancelled = await seedBounty({ status: "cancelled", cancelledAt,
    createdAt: new Date("2026-10-01T13:00:00Z") });
  const completion = { type: "completed", timestamp: completedAt.toISOString(),
    bountyId: completed.id, creator: identity(alice), winner: identity(bob) };
  assert.deepEqual(await readEvents(await request()), [
    { type: "cancelled", timestamp: cancelledAt.toISOString(), bountyId: cancelled.id,
      creator: identity(alice), winner: null },
    completion,
    { type: "created", timestamp: cancelled.createdAt.toISOString(), bountyId: cancelled.id,
      creator: identity(alice), winner: null },
    { type: "created", timestamp: createdAt.toISOString(), bountyId: completed.id,
      creator: identity(alice), winner: null },
  ]);
  assert.deepEqual(await readEvents(await request(bob.id)), [completion]);
  assert.deepEqual(await readEvents(await request(creator.id)), []);
});

test("drafts and unrelated bounties produce no events", async () => {
  await seedBounty({ status: "draft" });
  await seedBounty({ creatorOsuUserId: bob.osuUserId });
  assert.deepEqual(await readEvents(await request()), []);
});

test("legacy cancellations without timestamps retain only their creation event", async () => {
  const row = await seedBounty({ status: "cancelled", cancelledAt: null });
  assert.deepEqual(await readEvents(await request()), [{ type: "created",
    timestamp: createdAt.toISOString(), bountyId: row.id, creator: identity(alice), winner: null }]);
});

test("missing joined identities remain null without losing completion events", async () => {
  const missingWinner = await seedBounty({ status: "completed", completedAt,
    completedByOsuUserId: 999999 });
  const missingCreator = await seedBounty({ status: "completed", completedAt,
    creatorOsuUserId: 999998, completedByOsuUserId: bob.osuUserId });
  const events = await readEvents(await request());
  assert.deepEqual(events[0], { type: "completed", timestamp: completedAt.toISOString(),
    bountyId: missingWinner.id, creator: identity(alice), winner: null });
  assert.deepEqual(await readEvents(await request(bob.id)), [{ type: "completed",
    timestamp: completedAt.toISOString(), bountyId: missingCreator.id,
    creator: null, winner: identity(bob) }]);
});

test("pagination counts events, orders newest first, and breaks timestamp ties deterministically", async () => {
  // 21 completed bounties yield 42 events, plus three newer creation events.
  // Reverse insertion order makes relying on database row order fail.
  const expected = [];
  for (let index = 24; index >= 1; index--) {
    const id = `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
    const timestamp = index <= 21 ? createdAt : cancelledAt;
    await seedBounty({ id, createdAt: timestamp,
      status: index <= 21 ? "completed" : "open",
      completedAt: index <= 21 ? timestamp : null,
      completedByOsuUserId: index <= 21 ? bob.osuUserId : null });
  }
  for (const index of [22, 23, 24, ...Array.from({ length: 21 }, (_, i) => i + 1)]) {
    const bountyId = `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
    if (index <= 21) expected.push({ bountyId, type: "completed" });
    expected.push({ bountyId, type: "created" });
  }
  const pages = [];
  for (const page of [1, 2, 3]) {
    const events = await readEvents(await request(alice.id, `?page=${page}`));
    assert.deepEqual(events.map(({ bountyId, type }) => ({ bountyId, type })),
      expected.slice((page - 1) * 20, page * 20));
    pages.push(events);
  }
  assert.deepEqual(pages.map(p => p.length), [20, 20, 5]);
  assert.equal(new Set(pages.flat().map(e => `${e.bountyId}:${e.type}`)).size, 45);
  assert.deepEqual(await readEvents(await request()), pages[0]);
  assert.deepEqual(await readEvents(await request(alice.id, "?page=4")), []);
});

test("existing profile with no bounties returns an empty array", async () => {
  assert.deepEqual(await readEvents(await request()), []);
});

test("unknown profile returns 404", async () => {
  const response = await request(randomUUID());
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { code: "USER_NOT_FOUND", error: "User not found" });
});

for (const id of ["not-a-uuid", "42"]) {
  test(`malformed profile ID ${id} returns 400`, async () => {
    const response = await request(id);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { code: "MALFORMED_USER_ID", error: "Malformed user ID" });
  });
}

for (const value of ["0", "-1", "1.5", "abc", "", "Infinity", "NaN", "9007199254740992"]) {
  test(`invalid page ${JSON.stringify(value)} returns 400`, async () => {
    const response = await request(alice.id, `?page=${encodeURIComponent(value)}`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      code: "MALFORMED_PAGE_INDEX", error: "Malformed page index provided.",
    });
  });
}

test("reading history does not mutate users, bounties or ledger entries", async () => {
  await seedBounty({ status: "completed", completedAt, completedByOsuUserId: bob.osuUserId });
  await db.insert(ledgerEntries).values({ userId: alice.id, amount: 25, reason: "daily_claim" });
  const snapshot = async () => ({
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  });
  const original = await snapshot();
  await readEvents(await request());
  await readEvents(await request(bob.id));
  assert.deepEqual(await snapshot(), original);
});

