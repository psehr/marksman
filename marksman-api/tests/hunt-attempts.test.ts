import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  huntAttemptScoreEvidenceSchema,
  huntAttemptVerificationResultSchema,
} from "@marksman/contracts";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

const pool = new Pool({
  connectionString: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
});
const db = drizzle({ client: pool, schema });
const testDatabase = createTestDatabase(db);
const endedAt = new Date("2026-10-16T12:01:00Z");
const discoveredAt = new Date("2026-10-16T12:01:05Z");
const scoreId = 7_598_383_773;
const evidence = huntAttemptScoreEvidenceSchema.parse({
  id: scoreId, ended_at: endedAt.toISOString(), user_id: 102,
  beatmap_id: 123, ruleset_id: 0, passed: true, accuracy: 0.99,
  mods: [], rank: "A", legacy_score_id: null, max_combo: 300,
  statistics: {},
});
const result = huntAttemptVerificationResultSchema.parse({
  playerIsClaimant: true, playerIsNotOwner: true, beatmapIsCorrect: true,
  rulesetIsCorrect: true, scoreIsPassed: true, modsAreCorrect: true,
  scoreIsWithinHuntPeriod: true, gradeIsSatisfied: true,
});
let huntId: string;

before(() => testDatabase.prepare());
beforeEach(async () => {
  await testDatabase.clear();
  const [user] = await db.insert(schema.users).values({
    osuUserId: 102, username: "hunter",
  }).returning();
  const [bounty] = await db.insert(schema.bounties).values({
    creatorOsuUserId: 101, status: "open", rewardBp: 30,
    goal: { type: "minimum_grade", beatmapId: 123, minimumGradeRequirement: "A",
      beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  const [hunt] = await db.insert(schema.bountyHunts).values({
    userId: user.id, bountyId: bounty.id, status: "ongoing",
    startedAt: new Date("2026-10-16T12:00:00Z"),
  }).returning();
  huntId = hunt.id;
});
after(async () => {
  try { await testDatabase.clearIfMigrated(); }
  finally { await pool.end(); }
});

function attempt() {
  return { huntId, scoreId, scoreEndedAt: endedAt, discoveredAt,
    scoreEvidence: evidence, verificationStatus: "pending" as const };
}

function pgError(code: string, constraint?: string) {
  return (error: unknown): boolean => {
    const outer = error as { cause?: unknown };
    const pg = (outer.cause ?? error) as { code: string; constraint?: string };
    assert.equal(pg.code, code);
    if (constraint) assert.equal(pg.constraint, constraint);
    return true;
  };
}

test("pending attempt round-trips a large score ID, evidence and timestamps", async () => {
  const [row] = await db.insert(schema.huntAttempts).values(attempt()).returning();
  assert.match(row.id, /^[0-9a-f-]{36}$/);
  assert.equal(row.scoreId, scoreId);
  assert.deepEqual(row.scoreEvidence, evidence);
  assert.deepEqual(row.scoreEndedAt, endedAt);
  assert.deepEqual(row.discoveredAt, discoveredAt);
  assert.equal(row.verificationResult, null);
  assert.equal(row.verifiedAt, null);
});

test("duplicate hunt/score pairs fail, but a different score in the same hunt succeeds", async () => {
  await db.insert(schema.huntAttempts).values(attempt());
  await assert.rejects(db.insert(schema.huntAttempts).values(attempt()),
    pgError("23505", "hunt_attempts_hunt_id_score_id_unique"));
  await db.insert(schema.huntAttempts).values({ ...attempt(), scoreId: scoreId + 1,
    scoreEvidence: { ...evidence, id: scoreId + 1 } });
});

test("the same score can belong to a restarted hunt", async () => {
  await db.insert(schema.huntAttempts).values(attempt());
  await pool.query("UPDATE bounty_hunts SET status = 'stopped', ended_at = $1 WHERE id = $2", [endedAt, huntId]);
  const { rows } = await pool.query("INSERT INTO bounty_hunts (user_id, bounty_id, status, started_at) SELECT user_id, bounty_id, 'ongoing', $1 FROM bounty_hunts WHERE id = $2 RETURNING id", [discoveredAt, huntId]);
  await db.insert(schema.huntAttempts).values({ ...attempt(), huntId: rows[0].id });
  // Interval eligibility is a service responsibility, not this unique constraint.
});

test("unknown hunt IDs fail the foreign key", async () => {
  await assert.rejects(db.insert(schema.huntAttempts).values({ ...attempt(), huntId: randomUUID() }),
    pgError("23503", "hunt_attempts_hunt_id_bounty_hunts_id_fk"));
});

test("SQL NULL evidence is rejected even when bypassing TypeScript", async () => {
  await assert.rejects(pool.query(
    "INSERT INTO hunt_attempts (hunt_id, score_id, score_ended_at, discovered_at, verification_status) VALUES ($1, $2, $3, $4, 'pending')",
    [huntId, scoreId, endedAt, discoveredAt]), pgError("23502"));
});

for (const status of ["pending", "valid", "invalid"] as const) {
  for (const hasResult of [false, true]) {
    for (const hasTimestamp of [false, true]) {
      test(`${status}: result=${hasResult}, timestamp=${hasTimestamp}`, async () => {
        const value = { ...attempt(), verificationStatus: status,
          verificationResult: hasResult ? { ...result, gradeIsSatisfied: status !== "invalid" } : null,
          verifiedAt: hasTimestamp ? discoveredAt : null };
        const allowed = status === "pending" ? !hasResult && !hasTimestamp : hasResult && hasTimestamp;
        const query = db.insert(schema.huntAttempts).values(value).returning();
        if (!allowed) {
          await assert.rejects(query, pgError("23514", "hunt_attempts_verification_state_check"));
        } else {
          const [row] = await query;
          assert.equal(row.verificationStatus, status);
          assert.deepEqual(row.verificationResult, value.verificationResult);
          assert.deepEqual(row.verifiedAt, value.verifiedAt);
        }
      });
    }
  }
}

test("verification must update status, result and timestamp together", async () => {
  const [row] = await db.insert(schema.huntAttempts).values(attempt()).returning();
  await assert.rejects(pool.query("UPDATE hunt_attempts SET verification_status = 'valid' WHERE id = $1", [row.id]),
    pgError("23514", "hunt_attempts_verification_state_check"));
  await pool.query("UPDATE hunt_attempts SET verification_status = 'valid', verification_result = $1, verified_at = $2 WHERE id = $3", [JSON.stringify(result), discoveredAt, row.id]);
  const { rows } = await pool.query("SELECT verification_status, verification_result, verified_at FROM hunt_attempts WHERE id = $1", [row.id]);
  assert.equal(rows[0].verification_status, "valid");
  assert.deepEqual(rows[0].verification_result, result);
  assert.deepEqual(rows[0].verified_at, discoveredAt);
});
