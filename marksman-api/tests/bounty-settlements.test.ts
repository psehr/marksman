import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

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
