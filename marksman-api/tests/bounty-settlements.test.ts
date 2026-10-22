import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { ensureBountySettlement, findDueBountySettlements, scheduleSettlementRetry, postponeSettlement } from "../src/db/bounty-settlements";

const pool = new Pool({
  connectionString: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
});
const db = drizzle({ client: pool, schema });
const testDatabase = createTestDatabase(db);
let bountyId: string;
const openedAt = new Date("2026-10-21T14:00:00+02:00");
const settleAfter = new Date("2026-10-21T12:00:30Z");

before(() => testDatabase.prepare());
beforeEach(async () => {
  await testDatabase.clear();
  const [bounty] = await db.insert(schema.bounties).values({
    creatorOsuUserId: 101, status: "open", rewardBp: 30,
    goal: { type: "minimum_grade", beatmapId: 123, minimumGradeRequirement: "A",
      beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  bountyId = bounty.id;
});
after(async () => {
  try { await testDatabase.clearIfMigrated(); }
  finally { await pool.end(); }
});

const settlement = () => ({ bountyId, openedAt, settleAfter, nextAttemptAt: settleAfter });

test("postponement changes only nextAttemptAt and supports transactions", async () => {
  const original = { ...settlement(), attempts: 2, lastError: "PREVIOUS_ERROR", settledAt: null };
  await db.insert(schema.bountySettlements).values(original);
  const next = new Date(settleAfter.getTime() + 5000);
  await db.transaction(tx => postponeSettlement(tx, bountyId, next));
  assert.deepEqual(await db.select().from(schema.bountySettlements), [{ ...original, nextAttemptAt: next }]);
});

test("postponement cannot change a settled row", async () => {
  const original = { ...settlement(), attempts: 2, lastError: null, settledAt: settleAfter };
  await db.insert(schema.bountySettlements).values(original);
  await postponeSettlement(db, bountyId, new Date());
  assert.deepEqual(await db.select().from(schema.bountySettlements), [original]);
});

test("postponement of a missing row does not create a settlement", async () => {
  await postponeSettlement(db, bountyId, settleAfter);
  assert.deepEqual(await db.select().from(schema.bountySettlements), []);
});

test("postponement rolls back with the enclosing transaction", async () => {
  await ensureBountySettlement(db, bountyId, openedAt);
  const original = await db.select().from(schema.bountySettlements);
  const failure = new Error("rollback postponement");
  await assert.rejects(db.transaction(async tx => {
    await postponeSettlement(tx, bountyId, new Date());
    throw failure;
  }), error => error === failure);
  assert.deepEqual(await db.select().from(schema.bountySettlements), original);
});

test("retry updates scheduling and increments attempts while preserving the window", async () => {
  await db.insert(schema.bountySettlements).values({ ...settlement(), attempts: 2 });
  const next = new Date(settleAfter.getTime() + 60000);
  const row = await db.transaction(tx => scheduleSettlementRetry(tx, bountyId, next, "TEST_ERROR"));
  assert.deepEqual(row, { ...settlement(), nextAttemptAt: next, attempts: 3, lastError: "TEST_ERROR", settledAt: null });
  assert.deepEqual(await db.select().from(schema.bountySettlements), [row]);
});

test("retry leaves successfully settled rows untouched", async () => {
  const original = { ...settlement(), settledAt: settleAfter, attempts: 2, lastError: null };
  await db.insert(schema.bountySettlements).values(original);
  assert.equal(await scheduleSettlementRetry(db, bountyId, new Date(), "LATE_ERROR"), undefined);
  assert.deepEqual(await db.select().from(schema.bountySettlements), [original]);
});

test("retry returns undefined for a missing settlement", async () => {
  assert.equal(await scheduleSettlementRetry(db, bountyId, settleAfter, "ERROR"), undefined);
  assert.deepEqual(await db.select().from(schema.bountySettlements), []);
});

test("concurrent retries increment the counter without lost updates", async () => {
  await ensureBountySettlement(db, bountyId, openedAt);
  await Promise.all(Array.from({ length: 5 }, () => scheduleSettlementRetry(db, bountyId, settleAfter, "ERROR")));
  const [row] = await db.select().from(schema.bountySettlements);
  assert.equal(row.attempts, 5);
  assert.deepEqual(row.settleAfter, settleAfter);
});

test("retry rolls back with its caller's transaction", async () => {
  await ensureBountySettlement(db, bountyId, openedAt);
  const original = await db.select().from(schema.bountySettlements);
  const failure = new Error("rollback retry");
  await assert.rejects(db.transaction(async tx => {
    await scheduleSettlementRetry(tx, bountyId, new Date(), "ERROR");
    throw failure;
  }), error => error === failure);
  assert.deepEqual(await db.select().from(schema.bountySettlements), original);
});

test("due query includes exact deadlines and supports a transaction connection", async () => {
  await ensureBountySettlement(db, bountyId, openedAt);
  assert.deepEqual(await findDueBountySettlements(db, new Date(settleAfter.getTime() - 1), 10), []);
  const rows = await db.transaction(tx => findDueBountySettlements(tx, settleAfter, 10));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bountySettlements.bountyId, bountyId);
  assert.deepEqual(Object.keys(rows[0]), ["bountySettlements"]);
});

for (const column of ["settleAfter", "nextAttemptAt"] as const) {
  test(`due query independently respects ${column}`, async () => {
    await db.insert(schema.bountySettlements).values({
      ...settlement(), [column]: new Date(settleAfter.getTime() + 1),
    });
    assert.deepEqual(await findDueBountySettlements(db, settleAfter, 10), []);
  });
}

test("due query excludes settled rows", async () => {
  await db.insert(schema.bountySettlements).values({ ...settlement(), settledAt: settleAfter });
  assert.deepEqual(await findDueBountySettlements(db, settleAfter, 10), []);
});

for (const status of ["draft", "cancelled", "completed"] as const) {
  test(`due query excludes ${status} bounties`, async () => {
    await ensureBountySettlement(db, bountyId, openedAt);
    await pool.query("UPDATE bounties SET status = $1 WHERE id = $2", [status, bountyId]);
    assert.deepEqual(await findDueBountySettlements(db, settleAfter, 10), []);
  });
}

test("due query orders by retry time then bounty ID before applying its limit", async () => {
  const ids = [3, 2, 1].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  for (const [index, id] of ids.entries()) {
    await pool.query("INSERT INTO bounties (id, status, reward_bp, goal, creator_osu_user_id) SELECT $1, status, reward_bp, goal, creator_osu_user_id FROM bounties WHERE id = $2", [id, bountyId]);
    await db.insert(schema.bountySettlements).values({
      ...settlement(), bountyId: id,
      nextAttemptAt: new Date(settleAfter.getTime() + (index === 0 ? 0 : 1)),
    });
  }
  const now = new Date(settleAfter.getTime() + 1);
  const rows = await findDueBountySettlements(db, now, 2);
  assert.deepEqual(rows.map(row => row.bountySettlements.bountyId), [ids[0], ids[2]]);
  assert.equal((await findDueBountySettlements(db, now, 10)).length, 3);
  assert.deepEqual(await findDueBountySettlements(db, now, 0), []);
});

test("due query returns an empty list when no settlements exist", async () => {
  assert.deepEqual(await findDueBountySettlements(db, settleAfter, 10), []);
});

test("ensure creates a settlement with a 30-second window", async () => {
  await ensureBountySettlement(db, bountyId, openedAt);
  assert.deepEqual(await db.select().from(schema.bountySettlements), [
    { ...settlement(), attempts: 0, lastError: null, settledAt: null },
  ]);
  assert.equal(openedAt.toISOString(), "2026-10-21T12:00:00.000Z");
});

test("repeated ensure preserves the original deadline and processing state", async () => {
  const original = { ...settlement(), attempts: 3, lastError: "retry",
    nextAttemptAt: new Date("2026-10-21T12:05:00Z"), settledAt: null };
  await db.insert(schema.bountySettlements).values(original);
  await ensureBountySettlement(db, bountyId, new Date("2026-10-21T13:00:00Z"));
  assert.deepEqual(await db.select().from(schema.bountySettlements), [original]);
});

test("ensure does not reopen an already settled row", async () => {
  const original = { ...settlement(), attempts: 1, lastError: null, settledAt: settleAfter };
  await db.insert(schema.bountySettlements).values(original);
  await ensureBountySettlement(db, bountyId, new Date("2026-10-21T13:00:00Z"));
  assert.deepEqual(await db.select().from(schema.bountySettlements), [original]);
});

test("ensure participates in the caller's transaction and rolls back", async () => {
  const failure = new Error("rollback");
  await assert.rejects(db.transaction(async tx => {
    await ensureBountySettlement(tx, bountyId, openedAt);
    assert.equal((await tx.select().from(schema.bountySettlements)).length, 1);
    throw failure;
  }), error => error === failure);
  assert.deepEqual(await db.select().from(schema.bountySettlements), []);
});

test("concurrent ensure calls preserve one complete window", async () => {
  const later = new Date(openedAt.getTime() + 10_000);
  await Promise.all([
    ensureBountySettlement(db, bountyId, openedAt),
    ensureBountySettlement(db, bountyId, later),
  ]);
  const rows = await db.select().from(schema.bountySettlements);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.ok([openedAt.getTime(), later.getTime()].includes(row.openedAt.getTime()));
  assert.equal(row.settleAfter.getTime(), row.openedAt.getTime() + 30_000);
  assert.deepEqual(row.nextAttemptAt, row.settleAfter);
});

test("ensure propagates foreign key errors", async () => {
  await assert.rejects(ensureBountySettlement(db, randomUUID(), openedAt), pgError("23503"));
});

function pgError(code: string) {
  return (error: unknown) => {
    const outer = error as { cause?: unknown };
    assert.equal(((outer.cause ?? error) as { code: string }).code, code);
    return true;
  };
}

test("new settlement preserves timestamp instants and defaults to unprocessed", async () => {
  await db.insert(schema.bountySettlements).values(settlement());
  const [row] = await db.select().from(schema.bountySettlements);
  assert.deepEqual(row, { ...settlement(), attempts: 0, lastError: null, settledAt: null });
  assert.equal(row.openedAt.toISOString(), "2026-10-21T12:00:00.000Z");
});

test("a bounty can have only one settlement", async () => {
  await db.insert(schema.bountySettlements).values(settlement());
  await assert.rejects(db.insert(schema.bountySettlements).values(settlement()), pgError("23505"));
});

test("a settlement must reference an existing bounty", async () => {
  await assert.rejects(db.insert(schema.bountySettlements).values({
    ...settlement(), bountyId: randomUUID(),
  }), pgError("23503"));
});

for (const column of ["bounty_id", "opened_at", "settle_after", "next_attempt_at", "attempts"]) {
  test(`${column} rejects explicit NULL`, async () => {
    await db.insert(schema.bountySettlements).values(settlement());
    // Column names come only from the fixed list above.
    await assert.rejects(pool.query(`UPDATE bounty_settlements SET ${column} = NULL`), pgError("23502"));
  });
}
