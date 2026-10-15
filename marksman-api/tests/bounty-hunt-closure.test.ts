import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import type { Bounty, UserIdentity } from "@marksman/contracts";
import { bounties, bountyHunts, ledgerEntries, users } from "../src/db/schema";
import { BountyNotOpenError, HuntSlotsFullError } from "../src/services/errors";
import { createTestDatabase } from "./fixtures/test-database";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_closure_tests&options=-c%20statement_timeout%3D10000",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { cancelBounty } = require("../src/services/bounties") as typeof import("../src/services/bounties");
const { completeBounty } = require("../src/services/bounty-completion") as typeof import("../src/services/bounty-completion");
const { startHunt, stopHunt } = require("../src/services/bounty-hunts") as typeof import("../src/services/bounty-hunts");
const testDatabase = createTestDatabase(db);
const now = new Date("2026-10-15T12:00:00Z");
let creator: UserIdentity;
let hunter: UserIdentity;
let other: UserIdentity;
let bountyId: string;
let upstreamCalls = 0;

async function seedBounty() {
  const [row] = await db.insert(bounties).values({
    creatorOsuUserId: creator.osuUserId, status: "open", rewardBp: 30,
    goal: { type: "minimum_grade", beatmapId: 123, minimumGradeRequirement: "A", beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  return row.id;
}
async function snapshot() {
  return {
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    hunts: await db.select().from(bountyHunts).orderBy(bountyHunts.id),
    users: await db.select().from(users).orderBy(users.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  };
}
before(async () => {
  mock.method(globalThis, "fetch", async () => { upstreamCalls++; throw new Error("Live upstream calls disabled"); });
  await testDatabase.prepare();
});
beforeEach(async () => {
  await testDatabase.clear();
  const rows = await db.insert(users).values([
    { osuUserId: 101, username: "creator", bpBalance: 70 },
    { osuUserId: 102, username: "hunter", bpBalance: 5 },
    { osuUserId: 103, username: "other", bpBalance: 10 },
  ]).returning();
  [creator, hunter, other] = rows.map(({ id, osuUserId, username }) => ({ id, osuUserId, username }));
  bountyId = await seedBounty();
  await db.insert(ledgerEntries).values([
    { userId: creator.id, amount: 100, reason: "initial_grant" },
    { userId: creator.id, amount: -30, reason: "bounty_funding", bountyId },
    { userId: hunter.id, amount: 5, reason: "initial_grant" },
    { userId: other.id, amount: 10, reason: "initial_grant" },
  ]);
  mock.timers.enable({ apis: ["Date"], now });
});
afterEach(() => mock.timers.reset());
after(async () => {
  try { await testDatabase.clearIfMigrated(); assert.equal(upstreamCalls, 0); }
  finally { mock.restoreAll(); await db.$client.end(); }
});
async function waitForLocks(count: number) {
  const deadline = performance.now() + 5000;
  while (true) {
    const { rows } = await db.$client.query("SELECT count(*)::integer AS waiting FROM pg_stat_activity WHERE application_name = 'marksman_closure_tests' AND datname = current_database() AND wait_event_type = 'Lock'");
    if (rows[0].waiting >= count) return;
    assert.ok(performance.now() < deadline, "Expected requests to reach their database locks");
    await delay(10);
  }
}

for (const mode of ["cancel", "complete"] as const) {
  const close = () => mode === "cancel" ? cancelBounty(bountyId, creator.osuUserId) : completeBounty(bountyId, 987654, hunter);
  const closureTime = (bounty: Bounty) => mode === "cancel" ? bounty.cancelledAt : bounty.completedAt;
  const expectedStatus = mode === "cancel" ? "cancelled" : "completed";
  const reason = mode === "cancel" ? "bounty_refund" : "bounty_reward";

  async function assertSettlement() {
    const state = await snapshot();
    const target = state.bounties.find(row => row.id === bountyId)!;
    assert.equal(target.status, expectedStatus);
    const settlement = state.ledger.filter(row => row.reason === reason);
    assert.equal(settlement.length, 1);
    assert.equal(settlement[0].amount, 30);
    assert.equal(settlement[0].userId, mode === "cancel" ? creator.id : hunter.id);
    for (const user of state.users) {
      assert.equal(user.bpBalance, state.ledger.filter(row => row.userId === user.id).reduce((sum, row) => sum + row.amount, 0));
    }
  }

  test(`${mode}: closes all ongoing hunts at the exact closure time, preserves history and unrelated hunts, and frees slots`, async () => {
    const unrelatedId = await seedBounty();
    const nextId = await seedBounty();
    const first = await startHunt(hunter, bountyId);
    const second = await startHunt(other, bountyId);
    await startHunt(hunter, unrelatedId);
    await startHunt(other, unrelatedId);
    const historicalEnd = new Date(now.getTime() - 1000);
    await db.insert(bountyHunts).values(["stopped", "closed"].map(status => ({
      userId: hunter.id, bountyId, status: status as "stopped" | "closed",
      startedAt: new Date(now.getTime() - 2000), endedAt: historicalEnd,
    })));
    await assert.rejects(() => startHunt(hunter, nextId), HuntSlotsFullError);
    await assert.rejects(() => startHunt(other, nextId), HuntSlotsFullError);
    const original = await snapshot();
    mock.timers.setTime(now.getTime() + 60000);
    const result = await close();
    assert.equal(closureTime(result), new Date(now.getTime() + 60000).toISOString());
    const state = await snapshot();
    assert.deepEqual(state.hunts, original.hunts.map(row => [first.id, second.id].includes(row.id)
      ? { ...row, status: "closed", endedAt: new Date(closureTime(result)!) } : row));
    assert.deepEqual(state.bounties.find(row => row.id === unrelatedId), original.bounties.find(row => row.id === unrelatedId));
    await assertSettlement();
    await startHunt(hunter, nextId);
    await startHunt(other, nextId);
    const closedState = await snapshot();
    mock.timers.setTime(now.getTime() + 120000);
    await assert.rejects(close, BountyNotOpenError);
    assert.deepEqual(await snapshot(), closedState);
  });

  test(`${mode}: hunt closure failure rolls back bounty, money, ledger and hunt updates; retry succeeds`, async () => {
    await startHunt(hunter, bountyId);
    await startHunt(other, bountyId);
    const original = await snapshot();
    await db.execute(sql.raw(`CREATE FUNCTION test_reject_closure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM bounties WHERE id = NEW.bounty_id AND status = '${expectedStatus}')
          OR NOT EXISTS (SELECT 1 FROM ledger_entries WHERE bounty_id = NEW.bounty_id AND reason = '${reason}') THEN
          RAISE EXCEPTION 'Expected bounty and money settlement before hunt closure';
        END IF;
        RAISE EXCEPTION 'Forced hunt closure failure';
      END; $$`));
    try {
      await db.execute(sql`CREATE TRIGGER test_reject_closure AFTER UPDATE ON bounty_hunts FOR EACH ROW EXECUTE FUNCTION test_reject_closure()`);
      await assert.rejects(close, (error: unknown) => {
        let cause = error;
        while (cause instanceof Error) { if (cause.message === "Forced hunt closure failure") return true; cause = cause.cause; }
        return false;
      });
      assert.deepEqual(await snapshot(), original);
    } finally {
      await db.execute(sql`DROP TRIGGER IF EXISTS test_reject_closure ON bounty_hunts`);
      await db.execute(sql`DROP FUNCTION test_reject_closure()`);
    }
    await close();
    assert.ok((await snapshot()).hunts.every(row => row.status === "closed"));
    await assertSettlement();
  });

  test(`${mode}: closure waits for an in-flight hunt start and captures time after locking`, async () => {
    const blocker = await db.$client.connect();
    let starting: ReturnType<typeof startHunt> | undefined;
    let closing: Promise<Bounty> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [hunter.id]);
      starting = startHunt(hunter, bountyId);
      await waitForLocks(1); // Start holds the bounty lock and waits on the user.
      closing = close();
      await waitForLocks(2);
      mock.timers.setTime(now.getTime() + 60000);
      await blocker.query("COMMIT");
      const started = await starting;
      const closed = await closing;
      assert.equal(started.startedAt, new Date(now.getTime() + 60000).toISOString());
      assert.equal(closureTime(closed), started.startedAt);
      const [stored] = (await snapshot()).hunts;
      assert.equal(stored.status, "closed");
      assert.equal(stored.endedAt?.toISOString(), closureTime(closed));
      await assertSettlement();
    } finally {
      await blocker.query("ROLLBACK"); blocker.release();
      await Promise.allSettled([starting, closing]);
    }
  });

  test(`${mode}: start waiting behind closure rejects without leaving an occupied slot`, async () => {
    const blocker = await db.$client.connect();
    let closing: Promise<Bounty> | undefined;
    let rejection: Promise<void> | undefined;
    try {
      await blocker.query("BEGIN");
      const recipient = mode === "cancel" ? creator : hunter;
      await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [recipient.id]);
      closing = close();
      await waitForLocks(1); // Closure owns the bounty lock, waiting to credit the user.
      rejection = assert.rejects(() => startHunt(other, bountyId), BountyNotOpenError);
      await waitForLocks(2);
      await blocker.query("COMMIT");
      await closing; await rejection;
      assert.deepEqual((await snapshot()).hunts, []);
      await assertSettlement();
    } finally {
      await blocker.query("ROLLBACK"); blocker.release();
      await Promise.allSettled([closing, rejection]);
    }
  });

  test(`${mode}: a concurrent stop finishes first and retains its own timestamp`, async () => {
    const hunt = await startHunt(other, bountyId);
    const blocker = await db.$client.connect();
    let stopping: ReturnType<typeof stopHunt> | undefined;
    let closing: Promise<Bounty> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [other.id]);
      stopping = stopHunt(other, hunt.id);
      await waitForLocks(1);
      closing = close();
      await waitForLocks(2);
      mock.timers.setTime(now.getTime() + 1000);
      await blocker.query("COMMIT");
      const stopped = await stopping;
      await closing;
      const stored = (await snapshot()).hunts[0];
      assert.equal(stored.status, "stopped");
      assert.equal(stored.endedAt?.toISOString(), stopped.endedAt);
      await assertSettlement();
    } finally {
      await blocker.query("ROLLBACK"); blocker.release();
      await Promise.allSettled([stopping, closing]);
    }
  });
}
