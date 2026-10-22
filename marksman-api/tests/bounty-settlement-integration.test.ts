import assert from "node:assert/strict";
import { before, beforeEach, after, mock, test } from "node:test";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { hunter, qualifyingBounty, qualifyingScore } from "./fixtures/completion";
import { evaluateHuntAttempt } from "../src/services/bounty-verification";

Object.assign(process.env, {
  PORT: "3001", NODE_ENV: "test",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=settlement_integration&options=-c%20statement_timeout%3D10000",
  FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db, pool } = require("../src/db") as typeof import("../src/db");
const { settleBounty } = require("../src/services/bounty-settlements") as typeof import("../src/services/bounty-settlements");
const testDb = createTestDatabase(db);
const bounty = qualifyingBounty();
const startedAt = new Date("2026-09-21T12:00:30Z");
const deadline = new Date("2026-09-21T12:02:00Z");
let winnerHuntId: string;
let otherHuntId: string;
let stoppedHuntId: string;

before(async () => {
  mock.method(globalThis, "fetch", async () => { throw new Error("Live network disabled"); });
  await testDb.prepare();
});
beforeEach(async () => {
  await testDb.clear();
  const people = await db.insert(schema.users).values([
    { id: hunter.id, osuUserId: hunter.osuUserId, username: "winner", bpBalance: 5 },
    { osuUserId: 43, username: "other", bpBalance: 10 },
    { osuUserId: 7, username: "creator", bpBalance: 70 },
  ]).returning();
  await db.insert(schema.bounties).values({
    id: bounty.id, creatorOsuUserId: bounty.creatorOsuUserId, status: "open",
    rewardBp: bounty.rewardBp, goal: bounty.goal, createdAt: new Date(bounty.createdAt),
  });
  await db.insert(schema.ledgerEntries).values(people.map(user => ({
    userId: user.id, amount: user.bpBalance, reason: "initial_grant" as const,
  })));
  const hunts = await db.insert(schema.bountyHunts).values([
    { bountyId: bounty.id, userId: hunter.id, status: "ongoing", startedAt },
    { bountyId: bounty.id, userId: people.find(p => p.osuUserId === 43)!.id, status: "ongoing", startedAt },
    { bountyId: bounty.id, userId: hunter.id, status: "stopped", startedAt,
      endedAt: new Date("2026-09-21T12:01:30Z") },
  ]).returning();
  [winnerHuntId, otherHuntId, stoppedHuntId] = hunts.map(h => h.id);
  await addAttempt(winnerHuntId, 987654, "valid");
  await db.insert(schema.bountySettlements).values({
    bountyId: bounty.id, openedAt: new Date(deadline.getTime() - 30000),
    settleAfter: deadline, nextAttemptAt: deadline,
  });
});
after(async () => {
  try { await testDb.clearIfMigrated(); }
  finally { mock.restoreAll(); await pool.end(); }
});

async function addAttempt(huntId: string, scoreId: number, status: "valid" | "pending", endedAt = "2026-09-21T12:01:00Z") {
  const score = { ...qualifyingScore(), id: scoreId, ended_at: endedAt };
  const [attempt] = await db.insert(schema.huntAttempts).values({
    huntId, scoreId, scoreEndedAt: new Date(endedAt), discoveredAt: deadline,
    scoreEvidence: score, verificationStatus: status,
    verificationResult: status === "valid" ? evaluateHuntAttempt(score, bounty, hunter, startedAt, null) : null,
    verifiedAt: status === "valid" ? deadline : null,
    nextVerificationAt: status === "pending" ? deadline : null,
  }).returning();
  return attempt;
}
async function snapshot() {
  return {
    bounties: await db.select().from(schema.bounties).orderBy(schema.bounties.id),
    users: await db.select().from(schema.users).orderBy(schema.users.id),
    ledger: await db.select().from(schema.ledgerEntries).orderBy(schema.ledgerEntries.id),
    hunts: await db.select().from(schema.bountyHunts).orderBy(schema.bountyHunts.id),
    attempts: await db.select().from(schema.huntAttempts).orderBy(schema.huntAttempts.id),
    settlements: await db.select().from(schema.bountySettlements).orderBy(schema.bountySettlements.bountyId),
  };
}
async function assertPaid() {
  const state = await snapshot();
  const completed = state.bounties[0];
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedByOsuUserId, hunter.osuUserId);
  assert.equal(completed.completionScoreId, 987654);
  assert.ok(completed.completedAt);
  assert.ok(state.settlements[0].settledAt);
  assert.deepEqual(state.settlements[0].settleAfter, deadline);
  assert.equal(state.users.find(u => u.id === hunter.id)!.bpBalance, 35);
  assert.equal(state.users.find(u => u.osuUserId === 43)!.bpBalance, 10);
  assert.equal(state.users.find(u => u.osuUserId === 7)!.bpBalance, 70);
  const rewards = state.ledger.filter(e => e.reason === "bounty_reward");
  assert.equal(rewards.length, 1);
  assert.deepEqual([rewards[0].userId, rewards[0].bountyId, rewards[0].amount], [hunter.id, bounty.id, 30]);
  for (const user of state.users) {
    assert.equal(state.ledger.filter(e => e.userId === user.id).reduce((sum, e) => sum + e.amount, 0), user.bpBalance);
  }
  for (const id of [winnerHuntId, otherHuntId]) {
    const hunt = state.hunts.find(h => h.id === id)!;
    assert.equal(hunt.status, "closed");
    assert.deepEqual(hunt.endedAt, completed.completedAt);
  }
  assert.equal(state.hunts.find(h => h.id === stoppedHuntId)!.status, "stopped");
}

test("settlement atomically stores winner, reward, ledger, hunt closure and settlement", async () => {
  await settleBounty(bounty.id);
  await assertPaid();
});
test("repeated settlement is a no-op after payment", async () => {
  await settleBounty(bounty.id);
  const paid = await snapshot();
  await settleBounty(bounty.id);
  assert.deepEqual(await snapshot(), paid);
  await assertPaid();
});
test("concurrent settlement calls pay exactly once", async () => {
  await Promise.all(Array.from({ length: 5 }, () => settleBounty(bounty.id)));
  await assertPaid();
});
test("an earlier pending attempt blocks a later valid attempt without writes", async () => {
  await addAttempt(stoppedHuntId, 987653, "pending", "2026-09-21T12:00:59Z");
  const original = await snapshot();
  await settleBounty(bounty.id);
  assert.deepEqual(await snapshot(), original);
});
test("a later pending attempt does not block the valid leader", async () => {
  await addAttempt(stoppedHuntId, 987655, "pending", "2026-09-21T12:01:01Z");
  await settleBounty(bounty.id);
  await assertPaid();
});
for (const column of ["settleAfter", "nextAttemptAt"] as const) {
  test(`future ${column} prevents payout`, async () => {
    await db.update(schema.bountySettlements).set({ [column]: new Date("2100-01-01") });
    const original = await snapshot();
    await settleBounty(bounty.id);
    assert.deepEqual(await snapshot(), original);
  });
}
for (const table of ["ledger_entries", "bounty_settlements"] as const) {
  test(`failure writing ${table} rolls back all payout changes`, async () => {
    // A real PostgreSQL constraint injects failure without replacing any service/helper.
    const expression = table === "ledger_entries" ? "reason <> 'bounty_reward'" : "settled_at IS NULL";
    await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT settlement_test_failure CHECK (${expression})`);
    try {
      const original = await snapshot();
      const started = Date.now();
      await assert.rejects(settleBounty(bounty.id), (error: unknown) => {
        const outer = error as { cause?: { code?: string }; code?: string };
        assert.equal(outer.cause?.code ?? outer.code, "23514");
        return true;
      });
      const failed = await snapshot();
      const retry = failed.settlements[0];
      assert.equal(retry.attempts, 1);
      assert.equal(retry.lastError, "SETTLEMENT_FAILED");
      assert.ok(retry.nextAttemptAt.getTime() >= started + 300000);
      assert.ok(retry.nextAttemptAt.getTime() <= Date.now() + 300000);
      assert.deepEqual(failed, {
        ...original,
        settlements: [{ ...original.settlements[0], attempts: 1,
          lastError: "SETTLEMENT_FAILED", nextAttemptAt: retry.nextAttemptAt }],
      });
      await settleBounty(bounty.id);
      assert.deepEqual(await snapshot(), failed, "Cooldown must prevent an immediate retry");
    } finally {
      await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT settlement_test_failure`);
    }
    // Make the retry due without waiting five minutes.
    await db.update(schema.bountySettlements).set({ nextAttemptAt: deadline });
    await settleBounty(bounty.id);
    await assertPaid();
  });
}
