import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { huntSchema } from "@marksman/contracts";
import { bounties, bountyHunts, ledgerEntries, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

// Configure the isolated database before loading the application or pool.
Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001", FRONTEND_URL: "http://localhost:3000/",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_hunt_http_tests&options=-c%20statement_timeout%3D10000",
  OSU_CLIENT_ID: "123", OSU_CLIENT_SECRET: "fixture-client-secret",
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
let hunter: typeof users.$inferSelect;
let other: typeof users.$inferSelect;
let bountyId: string;
let upstreamCalls = 0;

before(async () => {
  await testDatabase.prepare();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await testDatabase.clear();
  upstreamCalls = 0;
  mock.method(globalThis, "fetch", async () => {
    upstreamCalls++;
    throw new Error("Live upstream calls are disabled");
  });
  [hunter, other] = await db.insert(users).values([
    { osuUserId: 101, username: "hunter", bpBalance: 100 },
    { osuUserId: 102, username: "other", bpBalance: 100 },
  ]).returning();
  const [bounty] = await db.insert(bounties).values({
    creatorOsuUserId: 999, rewardBp: 25, status: "open",
    goal: { type: "minimum_grade", beatmapId: 123, minimumGradeRequirement: "A", beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  bountyId = bounty.id;
});
afterEach(() => {
  mock.restoreAll();
  assert.equal(upstreamCalls, 0, "Hunt endpoints must not call upstream services");
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
    cookie: { originalMaxAge: 60_000, expires: expire.toISOString(), httpOnly: true, path: "/", sameSite: "lax" }, userId,
  } });
  const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(sid).digest("base64").replace(/=+$/, "");
  return `marksman.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}
async function request(options: { userId?: string | null; origin?: string | null; id?: string; body?: unknown; query?: string; stopHuntId?: string } = {}) {
  const { userId = hunter.id, origin = "http://localhost:3000", id = bountyId, body, query = "" } = options;
  const headers: Record<string, string> = {};
  if (userId) headers.Cookie = await cookieFor(userId);
  if (origin !== null) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const path = options.stopHuntId === undefined
    ? `/bounties/${id}/hunt`
    : `/hunts/${options.stopHuntId}/stop`;
  return httpFetch(`${baseUrl}${path}${query}`, {
    method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function snapshot() {
  return {
    hunts: await db.select().from(bountyHunts).orderBy(bountyHunts.id),
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  };
}
async function expectError(response: Response, status: number, code: string, error: string) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), { code, error });
}
async function unchangedError(options: Parameters<typeof request>[0], status: number, code: string, error: string) {
  const original = await snapshot();
  await expectError(await request(options), status, code, error);
  assert.deepEqual(await snapshot(), original);
}

test("requires authentication", () => unchangedError({ userId: null }, 401, "NOT_LOGGED_IN", "Not logged in"));
test("rejects a session for a deleted user", () => unchangedError({ userId: randomUUID() }, 401, "NOT_LOGGED_IN", "Not logged in"));
for (const origin of [null, "null", "https://attacker.example", "http://localhost:3000.attacker.example"]) {
  test(`rejects untrusted Origin ${origin === null ? "(missing)" : JSON.stringify(origin)}`, () => unchangedError({ origin }, 403, "UNTRUSTED_ORIGIN", "Untrusted request origin"));
}
test("rejects malformed bounty UUID", () => unchangedError({ id: "not-a-uuid" }, 400, "MALFORMED_BOUNTY_ID", "Malformed bounty ID"));
test("returns 404 for missing bounty", () => unchangedError({ id: randomUUID() }, 404, "BOUNTY_NOT_FOUND", "Bounty not found"));
for (const status of ["draft", "completed", "cancelled"] as const) {
  test(`rejects ${status} bounty`, async () => {
    await db.update(bounties).set({ status }).where(eq(bounties.id, bountyId));
    await unchangedError({}, 409, "BOUNTY_NOT_OPEN", "Bounty status is not open");
  });
}
test("rejects the creator", async () => {
  await db.update(bounties).set({ creatorOsuUserId: hunter.osuUserId }).where(eq(bounties.id, bountyId));
  await unchangedError({}, 403, "BOUNTY_OWN_HUNT", "Attempting to hunt own bounty");
});
test("returns a persisted indefinite hunt and ignores client-supplied identity and timing", async () => {
  const original = await snapshot();
  const before = Date.now();
  const response = await request({ query: `?userId=${other.id}`, body: {
    userId: other.id, osuUserId: other.osuUserId, bountyId: randomUUID(),
    identity: { id: other.id, osuUserId: other.osuUserId },
    status: "completed", startedAt: "2000-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z",
  } });
  assert.equal(response.status, 200);
  const body = await response.json();
  const hunt = huntSchema.parse(body);
  assert.deepEqual(hunt, body);
  assert.equal(hunt.userId, hunter.id);
  assert.equal(hunt.bountyId, bountyId);
  assert.equal(hunt.status, "ongoing");
  assert.equal(hunt.endedAt, null);

  assert.ok(Date.parse(hunt.startedAt) >= before && Date.parse(hunt.startedAt) <= Date.now());

  const state = await snapshot();
  assert.deepEqual(state.hunts, [{ ...hunt, startedAt: new Date(hunt.startedAt) }]);
  assert.deepEqual(state.users, original.users);
  assert.deepEqual(state.bounties, original.bounties);
  assert.deepEqual(state.ledger, original.ledger);
});
test("repeated start returns duplicate conflict without another hunt", async () => {
  assert.equal((await request()).status, 200);
  await unchangedError({}, 409, "DUPLICATE_HUNTING", "User is already hunting the bounty");
});
test("two slots succeed and the third returns HUNT_SLOTS_FULL", async () => {
  const [second, third] = await db.insert(bounties).values([1, 2].map(() => ({
    creatorOsuUserId: 999, rewardBp: 25, status: "open" as const,
    goal: { type: "minimum_grade" as const, beatmapId: 123, minimumGradeRequirement: "A" as const, beatmapChecksum: null, modRequirement: { rule: "any" as const } },
  }))).returning();
  assert.equal((await request()).status, 200);
  assert.equal((await request({ id: second.id })).status, 200);
  await unchangedError({ id: third.id }, 409, "HUNT_SLOTS_FULL", "User has no available hunting slot");
  assert.equal((await request({ id: third.id, userId: other.id })).status, 200);
});
test("maps user disappearing after authentication to 404", async () => {
  const blocker = await db.$client.connect();
  let pending: Promise<Response> | undefined;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM bounties WHERE id = $1 FOR UPDATE", [bountyId]);
    pending = request();
    // The service waits on the bounty only after real session authentication.
    const deadline = performance.now() + 5000;
    while (true) {
      const { rows } = await db.$client.query("SELECT count(*)::integer AS waiting FROM pg_stat_activity WHERE application_name = 'marksman_hunt_http_tests' AND datname = current_database() AND wait_event_type = 'Lock'");
      if (rows[0].waiting >= 1) break;
      assert.ok(performance.now() < deadline, "Request must reach the bounty lock");
      await delay(20);
    }
    await db.delete(users).where(eq(users.id, hunter.id));
    const original = await snapshot();
    await blocker.query("COMMIT");
    await expectError(await pending, 404, "USER_NOT_FOUND", "User was not found");
    assert.deepEqual(await snapshot(), original);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await pending;
  }
});
test("unexpected database error reaches central 500, rolls back, and permits retry", async () => {
  const logged = mock.method(console, "error", () => {});
  await db.execute(sql`CREATE FUNCTION test_http_reject_hunt() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Forced HTTP hunt failure'; END; $$`);
  try {
    await db.execute(sql`CREATE TRIGGER test_http_reject_hunt BEFORE INSERT ON bounty_hunts FOR EACH ROW EXECUTE FUNCTION test_http_reject_hunt()`);
    await unchangedError({}, 500, "UNEXPECTED_ERROR", "Internal server error");
    assert.equal(logged.mock.callCount(), 1);
  } finally {
    await db.execute(sql`DROP TRIGGER IF EXISTS test_http_reject_hunt ON bounty_hunts`);
    await db.execute(sql`DROP FUNCTION test_http_reject_hunt()`);
  }
  assert.equal((await request()).status, 200);
  assert.equal((await snapshot()).hunts.length, 1);
});

async function stoppingFixture() {
  const [hunt] = await db.insert(bountyHunts).values({
    userId: hunter.id, bountyId, status: "ongoing",
    startedAt: new Date(Date.now() - 30 * 86400000),
  }).returning();
  return hunt;
}

test("stopping requires authentication", async () => {
  const hunt = await stoppingFixture();
  await unchangedError({ stopHuntId: hunt.id, userId: null }, 401, "NOT_LOGGED_IN", "Not logged in");
});
test("stopping rejects a deleted-user login session", async () => {
  const hunt = await stoppingFixture();
  await unchangedError({ stopHuntId: hunt.id, userId: randomUUID() }, 401, "NOT_LOGGED_IN", "Not logged in");
});
for (const origin of [null, "null", "https://attacker.example", "http://localhost:3000.attacker.example"]) {
  test(`stopping rejects untrusted Origin ${JSON.stringify(origin)}`, async () => {
    const hunt = await stoppingFixture();
    await unchangedError({ stopHuntId: hunt.id, origin }, 403, "UNTRUSTED_ORIGIN", "Untrusted request origin");
  });
}
test("stopping rejects malformed hunt UUID", () =>
  unchangedError({ stopHuntId: "not-a-uuid" }, 400, "MALFORMED_HUNT_ID", "Malformed hunt ID"));
test("stopping returns 404 for missing hunt", () =>
  unchangedError({ stopHuntId: randomUUID() }, 404, "HUNT_NOT_FOUND", "Hunt not found"));
test("stopping rejects another user's hunt despite supplied owner identity", async () => {
  const hunt = await stoppingFixture();
  await unchangedError({ stopHuntId: hunt.id, userId: other.id,
    query: `?userId=${hunter.id}`, body: { userId: hunter.id, identity: { id: hunter.id, osuUserId: hunter.osuUserId } },
  }, 403, "HUNT_NOT_OWNED", "Hunt not owned by the requester");
});
for (const status of ["draft", "completed", "cancelled"] as const) {
  test(`stopping rejects ${status} bounty without a strike`, async () => {
    const hunt = await stoppingFixture();
    await db.update(bounties).set({ status }).where(eq(bounties.id, bountyId));
    await unchangedError({ stopHuntId: hunt.id }, 409, "BOUNTY_NOT_OPEN", "Bounty status is not open");
  });
}
for (const status of ["stopped", "closed"] as const) {
  test(`stopping rejects ${status} hunt`, async () => {
    const hunt = await stoppingFixture();
    await db.update(bountyHunts).set({ status, endedAt: new Date() }).where(eq(bountyHunts.id, hunt.id));
    await unchangedError({ stopHuntId: hunt.id }, 409, "HUNT_NOT_ONGOING", "Hunt not currently ongoing");
  });
}
test("stopping an old hunt persists ISO response and ignores supplied fields", async () => {
  const hunt = await stoppingFixture();
  const [otherHunt] = await db.insert(bountyHunts).values({ userId: other.id, bountyId, status: "ongoing" }).returning();
  const original = await snapshot();
  const before = Date.now();
  const response = await request({ stopHuntId: hunt.id, query: `?userId=${other.id}`, body: {
    userId: other.id, identity: { id: other.id, osuUserId: other.osuUserId }, huntId: otherHunt.id,
    bountyId: randomUUID(), status: "closed", startedAt: "2000-01-01T00:00:00Z", endedAt: "2000-01-01T00:00:00Z",
  } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  const body = await response.json();
  const result = huntSchema.parse(body);
  assert.deepEqual(result, body);
  assert.ok(result.endedAt);
  const endedAt = new Date(result.endedAt);
  assert.ok(endedAt.getTime() >= before && endedAt.getTime() <= Date.now());
  assert.deepEqual(result, { ...hunt, status: "stopped", startedAt: hunt.startedAt.toISOString(), endedAt: endedAt.toISOString() });
  assert.deepEqual(await snapshot(), { ...original, hunts: original.hunts.map(row => row.id === hunt.id ? { ...row, status: "stopped", endedAt } : row) });
  await unchangedError({ stopHuntId: hunt.id }, 409, "HUNT_NOT_ONGOING", "Hunt not currently ongoing");
  const restart = await request();
  assert.equal(restart.status, 200);
  assert.notEqual((await restart.json()).id, hunt.id);
});
test("stopping central 500 rolls back hunt update and permits retry", async () => {
  const hunt = await stoppingFixture();
  const logged = mock.method(console, "error", () => {});
  await db.execute(sql`CREATE FUNCTION test_http_reject_stopping() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Forced HTTP stopping failure'; END; $$`);
  try {
    await db.execute(sql`CREATE TRIGGER test_http_reject_stopping AFTER UPDATE ON bounty_hunts FOR EACH ROW EXECUTE FUNCTION test_http_reject_stopping()`);
    await unchangedError({ stopHuntId: hunt.id }, 500, "UNEXPECTED_ERROR", "Internal server error");
    assert.equal(logged.mock.callCount(), 1);
  } finally {
    await db.execute(sql`DROP TRIGGER IF EXISTS test_http_reject_stopping ON bounty_hunts`);
    await db.execute(sql`DROP FUNCTION test_http_reject_stopping()`);
  }
  assert.equal((await request({ stopHuntId: hunt.id })).status, 200);
  const state = await snapshot();
  assert.equal(state.hunts[0].status, "stopped");
});

for (const missing of ["user", "bounty"] as const) {
  test(`stopping maps ${missing} disappearing after authentication to 404`, async () => {
    const hunt = await stoppingFixture();
    const blocker = await db.$client.connect();
    let pending: Promise<Response> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM bounties WHERE id = $1 FOR UPDATE", [bountyId]);
      pending = request({ stopHuntId: hunt.id });
      // Waiting for this lock proves authentication and the initial hunt read completed.
      const deadline = performance.now() + 5000;
      while (true) {
        const { rows } = await db.$client.query("SELECT count(*)::integer AS waiting FROM pg_stat_activity WHERE application_name = 'marksman_hunt_http_tests' AND datname = current_database() AND wait_event_type = 'Lock'");
        if (rows[0].waiting >= 1) break;
        assert.ok(performance.now() < deadline, "Stopping must reach the bounty lock");
        await delay(20);
      }
      // Remove dependent fixtures first to preserve real foreign-key constraints.
      await blocker.query("DELETE FROM bounty_hunts WHERE id = $1", [hunt.id]);
      if (missing === "user") await blocker.query("DELETE FROM users WHERE id = $1", [hunter.id]);
      else await blocker.query("DELETE FROM bounties WHERE id = $1", [bountyId]);
      await blocker.query("COMMIT");
      const original = await snapshot();
      await expectError(await pending, 404,
        missing === "user" ? "USER_NOT_FOUND" : "BOUNTY_NOT_FOUND",
        missing === "user" ? "User was not found" : "Bounty not found");
      assert.deepEqual(await snapshot(), original);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await pending;
    }
  });
}
