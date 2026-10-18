import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import { huntAttemptScoreEvidenceSchema } from "@marksman/contracts";
import { bounties, bountyHunts, huntAttempts, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { findDueHuntAttempts } = require("../src/db/bounty-hunts-attempts") as typeof import("../src/db/bounty-hunts-attempts");
const testDatabase = createTestDatabase(db);
const now = new Date("2026-10-18T12:05:00Z");
const earlier = new Date(now.getTime() - 1);
const evidence = huntAttemptScoreEvidenceSchema.parse({
  id: 7_598_383_773, ended_at: "2026-10-18T12:01:00Z", user_id: 102,
  beatmap_id: 123, ruleset_id: 0, passed: true, accuracy: 0.99,
  mods: [], rank: "A", legacy_score_id: null, max_combo: 300, statistics: {},
});
let huntId: string;
let sequence: number;

before(() => testDatabase.prepare());
beforeEach(async () => {
  await testDatabase.clear();
  sequence = 0;
  const [user] = await db.insert(users).values({ osuUserId: 102, username: "hunter" }).returning();
  const [bounty] = await db.insert(bounties).values({
    creatorOsuUserId: 101, status: "open", rewardBp: 30,
    goal: { type: "minimum_grade", beatmapId: 123, minimumGradeRequirement: "A",
      beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  const [hunt] = await db.insert(bountyHunts).values({
    userId: user.id, bountyId: bounty.id, status: "ongoing",
    startedAt: new Date("2026-10-18T12:00:00Z"),
  }).returning();
  huntId = hunt.id;
});
after(async () => {
  try { await testDatabase.clearIfMigrated(); }
  finally { await db.$client.end(); }
});

async function seedAttempt(overrides: Partial<typeof huntAttempts.$inferInsert> = {}) {
  const scoreId = evidence.id + sequence++;
  const [row] = await db.insert(huntAttempts).values({
    huntId, scoreId, scoreEvidence: { ...evidence, id: scoreId },
    scoreEndedAt: new Date(evidence.ended_at), discoveredAt: new Date("2026-10-18T12:02:00Z"),
    verificationStatus: "pending", nextVerificationAt: now, ...overrides,
  }).returning();
  return row;
}

test("includes overdue and exactly due attempts and serializes their fields", async () => {
  const exact = await seedAttempt();
  const overdue = await seedAttempt({ nextVerificationAt: earlier,
    verificationAttempts: 2, lastVerificationError: "OSU_API_ERROR" });
  const rows = await findDueHuntAttempts(db, now, 10);
  assert.deepEqual(rows.map(row => row.id), [overdue.id, exact.id]);
  assert.deepEqual(rows[0], {
    ...overdue, scoreEndedAt: overdue.scoreEndedAt.toISOString(),
    discoveredAt: overdue.discoveredAt.toISOString(), nextVerificationAt: earlier.toISOString(),
  });
});

test("excludes future and unscheduled pending attempts", async () => {
  await seedAttempt({ nextVerificationAt: new Date(now.getTime() + 1) });
  await seedAttempt({ nextVerificationAt: null });
  assert.deepEqual(await findDueHuntAttempts(db, now, 10), []);
});

for (const status of ["valid", "invalid"] as const) {
  test(`excludes ${status} attempts even with an overdue retry time`, async () => {
    await seedAttempt({ verificationStatus: status, nextVerificationAt: earlier,
      verifiedAt: earlier, verificationResult: {
        playerIsClaimant: true, playerIsNotOwner: true, beatmapIsCorrect: true,
        rulesetIsCorrect: true, scoreIsPassed: true, modsAreCorrect: true,
        scoreIsWithinHuntPeriod: true, gradeIsSatisfied: status === "valid",
      } });
    assert.deepEqual(await findDueHuntAttempts(db, now, 10), []);
  });
}

test("orders by retry time then ID before applying the batch limit", async () => {
  const ids = [1, 2, 3].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  await seedAttempt({ id: ids[1] });
  await seedAttempt({ id: ids[0] });
  await seedAttempt({ id: ids[2], nextVerificationAt: earlier });
  assert.deepEqual((await findDueHuntAttempts(db, now, 10)).map(row => row.id),
    [ids[2], ids[0], ids[1]]);
  assert.deepEqual((await findDueHuntAttempts(db, now, 2)).map(row => row.id),
    [ids[2], ids[0]]);
});

test("returns an empty array when no attempts exist", async () => {
  assert.deepEqual(await findDueHuntAttempts(db, now, 10), []);
});

test("includes due attempts after their hunt has stopped", async () => {
  const attempt = await seedAttempt();
  await db.update(bountyHunts).set({ status: "stopped", endedAt: now }).where(eq(bountyHunts.id, huntId));
  assert.deepEqual((await findDueHuntAttempts(db, now, 10)).map(row => row.id), [attempt.id]);
});
