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
const { findDueHuntAttempts, findLeadingHuntAttempt } = require("../src/db/bounty-hunts-attempts") as typeof import("../src/db/bounty-hunts-attempts");
const testDatabase = createTestDatabase(db);
const now = new Date("2026-10-18T12:05:00Z");
const earlier = new Date(now.getTime() - 1);
const evidence = huntAttemptScoreEvidenceSchema.parse({
  id: 7_598_383_773, ended_at: "2026-10-18T12:01:00Z", user_id: 102,
  beatmap_id: 123, ruleset_id: 0, passed: true, accuracy: 0.99,
  mods: [], rank: "A", legacy_score_id: null, max_combo: 300, statistics: {},
});
let huntId: string;
let bountyId: string;
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
  bountyId = bounty.id;
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

test("leading attempt excludes scores belonging to another bounty", async () => {
  const own = await seedAttempt();
  const [originalHunt] = await db.select().from(bountyHunts).where(eq(bountyHunts.id, huntId));
  const [originalBounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
  const [otherBounty] = await db.insert(bounties).values({
    status: "open", rewardBp: 30, creatorOsuUserId: 101, goal: originalBounty.goal,
  }).returning();
  const [otherHunt] = await db.insert(bountyHunts).values({
    bountyId: otherBounty.id, userId: originalHunt.userId,
    status: "ongoing", startedAt: originalHunt.startedAt,
  }).returning();
  await seedAttempt({ huntId: otherHunt.id, scoreEndedAt: new Date(own.scoreEndedAt.getTime() - 1) });
  assert.equal((await findLeadingHuntAttempt(db, bountyId))?.id, own.id);
});

test("leading attempt returns undefined for a bounty with no attempts", async () => {
  assert.equal(await findLeadingHuntAttempt(db, bountyId), undefined);
});

test("leading attempt prioritizes finish time then numeric score ID and includes stopped hunts", async () => {
  const first = await seedAttempt({ scoreId: 100, scoreEndedAt: new Date("2026-10-18T12:01:02Z") });
  await seedAttempt({ scoreId: 20, scoreEndedAt: new Date("2026-10-18T12:01:01Z") });
  const leader = await seedAttempt({ scoreId: 9, scoreEndedAt: new Date("2026-10-18T12:01:01Z") });
  await db.update(bountyHunts).set({ status: "stopped", endedAt: now }).where(eq(bountyHunts.id, huntId));
  const found = await db.transaction(tx => findLeadingHuntAttempt(tx, bountyId));
  assert.equal(found?.id, leader.id);
  assert.equal(found?.scoreEndedAt, leader.scoreEndedAt.toISOString());
  assert.notEqual(found?.id, first.id);
});

test("an earlier pending attempt leads a valid attempt; invalid attempts are excluded", async () => {
  const pending = await seedAttempt({ nextVerificationAt: new Date(now.getTime() + 60_000) });
  const result = {
    playerIsClaimant: true, playerIsNotOwner: true, beatmapIsCorrect: true,
    rulesetIsCorrect: true, scoreIsPassed: true, modsAreCorrect: true,
    scoreIsWithinHuntPeriod: true, gradeIsSatisfied: true,
  };
  const valid = await seedAttempt({ verificationStatus: "valid", verifiedAt: now, verificationResult: result,
    scoreEndedAt: new Date(pending.scoreEndedAt.getTime() + 1) });
  await seedAttempt({ verificationStatus: "invalid", verifiedAt: now,
    verificationResult: { ...result, gradeIsSatisfied: false },
    scoreEndedAt: new Date(pending.scoreEndedAt.getTime() - 1) });
  assert.equal((await findLeadingHuntAttempt(db, bountyId))?.id, pending.id);
  await db.update(huntAttempts).set({ verificationStatus: "invalid", verifiedAt: now,
    verificationResult: { ...result, gradeIsSatisfied: false } }).where(eq(huntAttempts.id, pending.id));
  assert.equal((await findLeadingHuntAttempt(db, bountyId))?.id, valid.id);
});

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
