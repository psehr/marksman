import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, afterEach, mock, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { huntSchema, type UserIdentity } from "@marksman/contracts";
import { bounties, bountyHunts, users, ledgerEntries } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { HuntNotOngoingError, HuntNotOwnedError, HuntNotFoundError, BountyNotFoundError, BountyNotOpenError, BountyOwnHuntError, HuntSlotsFullError, DuplicateHuntingError, UserNotFoundError } from "../src/services/errors";

// Select the isolated database before importing modules that initialize the pool.
process.env.DATABASE_URL = "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_hunt_tests&options=-c%20statement_timeout%3D10000";
Object.assign(process.env, {
  PORT: "3001", FRONTEND_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "123", OSU_CLIENT_SECRET: "fixture-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-hunt-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { startHunt, stopHunt } = require("../src/services/bounty-hunts") as typeof import("../src/services/bounty-hunts");
const testDatabase = createTestDatabase(db);
const now = new Date("2026-10-12T12:00:00.000Z");
let hunter: UserIdentity;
let other: UserIdentity;
let bountyId: string;
let otherBountyId: string;

async function seedBounty() {
  const [row] = await db.insert(bounties).values({
    creatorOsuUserId: 999, rewardBp: 25, status: "open",
    goal: { type: "minimum_grade", beatmapId: 123, minimumGradeRequirement: "A", beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  return row.id;
}
async function seedHunt(status: typeof bountyHunts.$inferSelect.status, target = bountyId, userId = hunter.id) {
  const [row] = await db.insert(bountyHunts).values({
    userId, bountyId: target, status, startedAt: new Date(now.getTime() - 30 * 86400000),
    endedAt: status === "ongoing" ? null : now,
  }).returning();
  return row;
}
async function snapshot() {
  return {
    hunts: await db.select().from(bountyHunts).orderBy(bountyHunts.id),
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  };
}
async function unchangedRejection(identity: UserIdentity, target: string, error: new (...args: never[]) => Error) {
  const original = await snapshot();
  await assert.rejects(() => startHunt(identity, target), error);
  assert.deepEqual(await snapshot(), original);
}
before(async () => {
  mock.method(globalThis, "fetch", async () => { throw new Error("Live upstream calls are disabled"); });
  await testDatabase.prepare();
});
beforeEach(async () => {
  await testDatabase.clear();
  const rows = await db.insert(users).values([
    { osuUserId: 101, username: "hunter", bpBalance: 100 },
    { osuUserId: 102, username: "other", bpBalance: 100 },
  ]).returning();
  [hunter, other] = rows.map(({ id, osuUserId, username }) => ({ id, osuUserId, username }));
  bountyId = await seedBounty();
  otherBountyId = await seedBounty();
  mock.timers.enable({ apis: ["Date"], now });
});
after(() => mock.restoreAll());
after(async () => {
  try { await testDatabase.clearIfMigrated(); } finally { await db.$client.end(); }
});
// Date is fixed per test for exact start/stop timestamp assertions.
afterEach(() => mock.timers.reset());

test("starts an indefinite hunt with the exact public shape and no economy changes", async () => {
  const original = await snapshot();
  const hunt = await startHunt(hunter, bountyId);
  assert.deepEqual(huntSchema.parse(hunt), hunt);
  assert.deepEqual(hunt, { id: hunt.id, userId: hunter.id, bountyId, status: "ongoing", startedAt: now.toISOString(), endedAt: null });
  assert.deepEqual(await snapshot(), { ...original, hunts: [{ ...hunt, startedAt: now }] });
});
test("rejects a missing bounty without changes", () => unchangedRejection(hunter, randomUUID(), BountyNotFoundError));
for (const status of ["draft", "completed", "cancelled"] as const) {
  test(`rejects a ${status} bounty without changes`, async () => {
    await db.update(bounties).set({ status }).where(eq(bounties.id, bountyId));
    await unchangedRejection(hunter, bountyId, BountyNotOpenError);
  });
}
test("rejects the creator using the numeric osu identity", async () => {
  await db.update(bounties).set({ creatorOsuUserId: hunter.osuUserId }).where(eq(bounties.id, bountyId));
  await unchangedRejection(hunter, bountyId, BountyOwnHuntError);
});
test("rejects a missing internal user", () => unchangedRejection({ ...hunter, id: randomUUID() }, bountyId, UserNotFoundError));

test("allows two hunts but rejects a third without changes", async () => {
  await startHunt(hunter, bountyId);
  await startHunt(hunter, otherBountyId);
  await unchangedRejection(hunter, await seedBounty(), HuntSlotsFullError);
});
test("duplicate rejection takes precedence even with both slots occupied", async () => {
  await startHunt(hunter, bountyId);
  await unchangedRejection(hunter, bountyId, DuplicateHuntingError);
  await startHunt(hunter, otherBountyId);
  await unchangedRejection(hunter, bountyId, DuplicateHuntingError);
});
test("old ongoing hunts never expire or release slots merely with elapsed time", async () => {
  await seedHunt("ongoing");
  await seedHunt("ongoing", otherBountyId);
  mock.timers.setTime(now.getTime() + 365 * 86400000);
  await unchangedRejection(hunter, await seedBounty(), HuntSlotsFullError);
});
for (const status of ["stopped", "closed"] as const) {
  test(`${status} history neither occupies slots nor prevents restarting`, async () => {
    const old = await seedHunt(status);
    await startHunt(hunter, bountyId);
    await startHunt(hunter, otherBountyId);
    assert.deepEqual((await snapshot()).hunts.find(row => row.id === old.id), old);
  });
}
test("players have independent slots even on the same bounties", async () => {
  await Promise.all([startHunt(hunter, bountyId), startHunt(other, bountyId)]);
  await Promise.all([startHunt(hunter, otherBountyId), startHunt(other, otherBountyId)]);
  assert.equal((await snapshot()).hunts.length, 4);
});
async function unchangedStop(identity: UserIdentity, id: string, error: new (...args: never[]) => Error) {
  const original = await snapshot();
  await assert.rejects(() => stopHunt(identity, id), error);
  assert.deepEqual(await snapshot(), original);
}
test("stopping an old hunt changes only status and end time", async () => {
  const hunt = await seedHunt("ongoing");
  await seedHunt("ongoing", otherBountyId);
  await seedHunt("ongoing", bountyId, other.id);
  const original = await snapshot();
  const stopped = await stopHunt(hunter, hunt.id);
  assert.deepEqual(stopped, { ...hunt, startedAt: hunt.startedAt.toISOString(), status: "stopped", endedAt: now.toISOString() });
  assert.deepEqual(huntSchema.parse(stopped), stopped);
  assert.deepEqual(await snapshot(), { ...original, hunts: original.hunts.map(row => row.id === hunt.id ? { ...row, status: "stopped", endedAt: now } : row) });
});
test("stopping immediately is allowed and repeated stops preserve the original end time", async () => {
  const hunt = await startHunt(hunter, bountyId);
  const stopped = await stopHunt(hunter, hunt.id);
  assert.equal(stopped.endedAt, hunt.startedAt);
  mock.timers.setTime(now.getTime() + 60000);
  await unchangedStop(hunter, hunt.id, HuntNotOngoingError);
});
test("stopping releases a full slot and repeated restarts have no cooldown", async () => {
  await startHunt(hunter, otherBountyId);
  const ids = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const hunt = await startHunt(hunter, bountyId);
    assert.ok(!ids.has(hunt.id)); ids.add(hunt.id);
    await stopHunt(hunter, hunt.id);
    mock.timers.setTime(now.getTime() + (i + 1) * 1000);
  }
  await startHunt(hunter, bountyId);
  const state = await snapshot();
  assert.equal(state.hunts.filter(row => row.status === "ongoing").length, 2);
  assert.equal(state.hunts.filter(row => row.status === "stopped").length, 5);
});
test("stopping rejects a missing hunt", () => unchangedStop(hunter, randomUUID(), HuntNotFoundError));
test("stopping checks internal owner identity", async () => {
  const hunt = await seedHunt("ongoing");
  await unchangedStop({ ...other, osuUserId: hunter.osuUserId }, hunt.id, HuntNotOwnedError);
});
for (const status of ["stopped", "closed"] as const) {
  test(`stopping rejects ${status} hunts`, async () => {
    const hunt = await seedHunt(status);
    await unchangedStop(hunter, hunt.id, HuntNotOngoingError);
  });
}
for (const status of ["draft", "completed", "cancelled"] as const) {
  test(`stopping rejects ${status} bounty without changes`, async () => {
    const hunt = await seedHunt("ongoing");
    await db.update(bounties).set({ status }).where(eq(bounties.id, bountyId));
    await unchangedStop(hunter, hunt.id, BountyNotOpenError);
  });
}
// Force contenders to wait on database locks instead of relying on scheduler timing.
async function waitForHuntLocks(count: number) {
  const deadline = performance.now() + 5000;
  while (true) {
    const { rows } = await db.$client.query("SELECT count(*)::integer AS waiting FROM pg_stat_activity WHERE application_name = 'marksman_hunt_tests' AND datname = current_database() AND wait_event_type = 'Lock'");
    if (rows[0].waiting >= count) return;
    assert.ok(performance.now() < deadline, "Expected hunt requests to contend on locks");
    await delay(20);
  }
}

for (const sameBounty of [true, false]) {
  test(`concurrent starts respect ${sameBounty ? "duplicate exclusion" : "two slots"}`, async () => {
    const third = await seedBounty();
    const blocker = await db.$client.connect();
    let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [hunter.id]);
      pending = Promise.allSettled([bountyId, sameBounty ? bountyId : otherBountyId, sameBounty ? bountyId : third].map(id => startHunt(hunter, id)));
      await waitForHuntLocks(3);
      mock.timers.setTime(now.getTime() + 60000);
      await blocker.query("COMMIT");
      const results = await pending;
      assert.equal(results.filter(r => r.status === "fulfilled").length, sameBounty ? 1 : 2);
      for (const result of results) if (result.status === "rejected") assert.ok(result.reason instanceof (sameBounty ? DuplicateHuntingError : HuntSlotsFullError));
      const state = await snapshot();
      assert.equal(state.hunts.length, sameBounty ? 1 : 2);
      for (const hunt of state.hunts) assert.equal(hunt.startedAt.getTime(), now.getTime() + 60000);
    } finally { await blocker.query("ROLLBACK"); blocker.release(); await pending; }
  });
}
test("concurrent stops commit exactly once using the time after locks", async () => {
  const hunt = await startHunt(hunter, bountyId);
  const blocker = await db.$client.connect();
  let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM bounties WHERE id = $1 FOR UPDATE", [bountyId]);
    pending = Promise.allSettled([stopHunt(hunter, hunt.id), stopHunt(hunter, hunt.id)]);
    await waitForHuntLocks(2);
    mock.timers.setTime(now.getTime() + 60000);
    await blocker.query("COMMIT");
    const results = await pending;
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const failure = results.find(r => r.status === "rejected");
    assert.ok(failure?.status === "rejected" && failure.reason instanceof HuntNotOngoingError);
    assert.equal((await snapshot()).hunts[0].endedAt?.getTime(), now.getTime() + 60000);
    mock.timers.setTime(now.getTime() + 120000);
    await unchangedStop(hunter, hunt.id, HuntNotOngoingError);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); await pending; }
});
for (const change of ["bounty", "hunt", "owner", "missing"] as const) {
  test(`stop rechecks ${change} after waiting on locks`, async () => {
    const hunt = await seedHunt("ongoing");
    const blocker = await db.$client.connect();
    let pending: Promise<void> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM bounties WHERE id = $1 FOR UPDATE", [bountyId]);
      pending = assert.rejects(() => stopHunt(hunter, hunt.id), change === "bounty" ? BountyNotOpenError : change === "owner" ? HuntNotOwnedError : change === "missing" ? HuntNotFoundError : HuntNotOngoingError);
      await waitForHuntLocks(1);
      if (change === "bounty") await blocker.query("UPDATE bounties SET status = 'cancelled' WHERE id = $1", [bountyId]);
      if (change === "hunt") await blocker.query("UPDATE bounty_hunts SET status = 'closed', ended_at = $2 WHERE id = $1", [hunt.id, now]);
      if (change === "owner") await blocker.query("UPDATE bounty_hunts SET user_id = $2 WHERE id = $1", [hunt.id, other.id]);
      if (change === "missing") await blocker.query("DELETE FROM bounty_hunts WHERE id = $1", [hunt.id]);
      await blocker.query("COMMIT");
      const expected = await snapshot();
      await pending;
      assert.deepEqual(await snapshot(), expected);
    } finally { await blocker.query("ROLLBACK"); blocker.release(); await pending; }
  });
}
test("concurrent stop and start preserve the two-slot limit without deadlock", async () => {
  const hunt = await startHunt(hunter, bountyId);
  await startHunt(hunter, otherBountyId);
  const third = await seedBounty();
  const blocker = await db.$client.connect();
  let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [hunter.id]);
    pending = Promise.allSettled([stopHunt(hunter, hunt.id), startHunt(hunter, third)]);
    await waitForHuntLocks(2);
    await blocker.query("COMMIT");
    const [stop, start] = await pending;
    assert.equal(stop.status, "fulfilled");
    if (start.status === "rejected") { assert.ok(start.reason instanceof HuntSlotsFullError); await startHunt(hunter, third); }
    assert.equal((await snapshot()).hunts.filter(row => row.status === "ongoing").length, 2);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); await pending; }
});
for (const operation of ["start", "stop"] as const) {
  test(`${operation} database failure rolls back and retry succeeds`, async () => {
    const hunt = await seedHunt("ongoing", otherBountyId);
    const action = () => operation === "start" ? startHunt(hunter, bountyId) : stopHunt(hunter, hunt.id);
    const original = await snapshot();
    await db.execute(sql`CREATE FUNCTION test_fail_hunt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Forced hunt failure'; END; $$`);
    try {
      await db.execute(sql.raw(`CREATE TRIGGER test_fail_hunt AFTER ${operation === "start" ? "INSERT" : "UPDATE"} ON bounty_hunts FOR EACH ROW EXECUTE FUNCTION test_fail_hunt()`));
      await assert.rejects(action, (error: unknown) => {
        let cause = error;
        while (cause instanceof Error) { if (cause.message === "Forced hunt failure") return true; cause = cause.cause; }
        return false;
      });
      assert.deepEqual(await snapshot(), original);
    } finally {
      await db.execute(sql`DROP TRIGGER IF EXISTS test_fail_hunt ON bounty_hunts`);
      await db.execute(sql`DROP FUNCTION test_fail_hunt()`);
    }
    assert.equal((await action()).status, operation === "start" ? "ongoing" : "stopped");
  });
}
