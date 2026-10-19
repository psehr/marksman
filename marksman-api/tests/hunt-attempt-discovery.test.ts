import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { eq } from "drizzle-orm";
import { huntAttemptScoreEvidenceSchema, type HuntAttemptVerificationResult } from "@marksman/contracts";
import { bounties, bountyHunts, huntAttempts, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { recordDiscoveredScore, recordDiscoveredScores } = require("../src/services/bounty-hunts-attempts") as typeof import("../src/services/bounty-hunts-attempts");
const testDatabase = createTestDatabase(db);
const start = new Date("2026-10-16T12:00:00Z");
const end = new Date("2026-10-16T12:02:00Z");
const discovery = new Date("2026-10-16T13:00:00Z");
const evidence = huntAttemptScoreEvidenceSchema.parse({
  id: 7_598_383_773, ended_at: "2026-10-16T12:01:00Z", user_id: 102,
  beatmap_id: 123, ruleset_id: 0, passed: true, accuracy: 0.8,
  mods: [], rank: "B", legacy_score_id: null, max_combo: 300, statistics: {},
});
let hunterId: string;
let otherId: string;
let bountyId: string;
let upstreamCalls = 0;

async function seedBounty(beatmapId = 123) {
  const [row] = await db.insert(bounties).values({
    creatorOsuUserId: 101, status: "open", rewardBp: 30,
    goal: { type: "minimum_grade", beatmapId, minimumGradeRequirement: "A",
      beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  return row.id;
}
async function seedHunt(overrides: Partial<typeof bountyHunts.$inferInsert> = {}) {
  const [row] = await db.insert(bountyHunts).values({
    userId: hunterId, bountyId, startedAt: start, status: "ongoing", ...overrides,
  }).returning();
  return row;
}
const attempts = () => db.select().from(huntAttempts).orderBy(huntAttempts.huntId);

test("batch records matching scores, preserves historical periods and deduplicates rediscovery", async () => {
  const hunt = await seedHunt({ status: "stopped", endedAt: end });
  const second = { ...evidence, id: evidence.id + 1 };
  const scores = [
    evidence, second, evidence,
    { ...evidence, id: evidence.id + 2, user_id: 999 },
    { ...evidence, id: evidence.id + 3, beatmap_id: 999 },
    { ...evidence, id: evidence.id + 4, ended_at: "2026-10-16T12:03:00Z" },
  ];
  assert.deepEqual(await recordDiscoveredScores(scores), []);
  const rows = await attempts();
  assert.deepEqual(rows.map(row => row.scoreId).sort(), [evidence.id, second.id]);
  for (const row of rows) {
    assert.equal(row.huntId, hunt.id);
    assert.equal(row.verificationStatus, "pending");
    assert.deepEqual(row.scoreEvidence, scores.find(score => score.id === row.scoreId));
  }
});

test("batch collects score failures and still records later scores", async () => {
  await seedHunt();
  const error = new Error("Forced discovery transaction failure");
  const originalTransaction = db.transaction.bind(db);
  let calls = 0;
  const transaction = mock.method(db, "transaction", (...args: Parameters<typeof db.transaction>) => {
    calls++;
    if (calls === 2 || calls === 3) return Promise.reject(error);
    return originalTransaction(...args);
  });
  try {
    const scores = [0, 1, 2, 3].map(offset => ({ ...evidence, id: evidence.id + offset }));
    assert.deepEqual(await recordDiscoveredScores(scores), [
      { scoreId: scores[1].id, error }, { scoreId: scores[2].id, error },
    ]);
    assert.equal(calls, 4);
    assert.deepEqual((await attempts()).map(row => row.scoreId).sort(), [scores[0].id, scores[3].id]);
  } finally { transaction.mock.restore(); }
});

test("batch propagates filter query failure before starting score transactions", async () => {
  const error = new Error("Forced pair lookup failure");
  const select = mock.method(db, "selectDistinct", () => { throw error; });
  const transaction = mock.method(db, "transaction", () => { throw new Error("Unexpected transaction"); });
  try {
    await assert.rejects(recordDiscoveredScores([evidence]), (caught: unknown) => caught === error);
    assert.equal(select.mock.callCount(), 1);
    assert.equal(transaction.mock.callCount(), 0);
  } finally { select.mock.restore(); transaction.mock.restore(); }
});

test("empty batch returns no failures without database access", async () => {
  const select = mock.method(db, "selectDistinct", () => { throw new Error("Unexpected query"); });
  const transaction = mock.method(db, "transaction", () => { throw new Error("Unexpected transaction"); });
  try {
    assert.deepEqual(await recordDiscoveredScores([]), []);
    assert.equal(select.mock.callCount(), 0);
    assert.equal(transaction.mock.callCount(), 0);
  } finally { select.mock.restore(); transaction.mock.restore(); }
});

test("unmatched batch returns no failures or attempts", async () => {
  await seedHunt();
  assert.deepEqual(await recordDiscoveredScores([{ ...evidence, user_id: 999 }]), []);
  assert.deepEqual(await attempts(), []);
});

before(async () => {
  mock.method(globalThis, "fetch", async () => {
    upstreamCalls++;
    throw new Error("Live upstream calls disabled");
  });
  await testDatabase.prepare();
});
beforeEach(async () => {
  await testDatabase.clear();
  const rows = await db.insert(users).values([
    { osuUserId: 102, username: "hunter" }, { osuUserId: 103, username: "other" },
  ]).returning();
  [hunterId, otherId] = rows.map(row => row.id);
  bountyId = await seedBounty();
  mock.timers.enable({ apis: ["Date"], now: discovery });
});
afterEach(() => mock.timers.reset());
after(async () => {
  try { await testDatabase.clearIfMigrated(); assert.equal(upstreamCalls, 0); }
  finally { mock.restoreAll(); await db.$client.end(); }
});

test("records a pending attempt with original evidence even when bounty requirements fail", async () => {
  const hunt = await seedHunt();
  await recordDiscoveredScore(evidence);
  const rows = await attempts();
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.huntId, hunt.id);
  assert.equal(row.scoreId, evidence.id);
  assert.deepEqual(row.scoreEndedAt, new Date(evidence.ended_at));
  assert.deepEqual(row.discoveredAt, discovery);
  assert.deepEqual(row.scoreEvidence, evidence);
  assert.equal(row.verificationStatus, "pending");
  assert.equal(row.verificationResult, null);
  assert.equal(row.verifiedAt, null);
});

test("matches only the score's player and difficulty across multiple bounties", async () => {
  const first = await seedHunt();
  const second = await seedHunt({ bountyId: await seedBounty() });
  await seedHunt({ userId: otherId });
  await seedHunt({ bountyId: await seedBounty(456) });
  await recordDiscoveredScore(evidence);
  const rows = await attempts();
  assert.deepEqual(rows.map(row => row.huntId).sort(), [first.id, second.id].sort());
  for (const row of rows) assert.deepEqual(row.discoveredAt, discovery);
});

test("unknown players and unmatched difficulties produce no attempts", async () => {
  await seedHunt();
  await recordDiscoveredScore({ ...evidence, user_id: 999 });
  await recordDiscoveredScore({ ...evidence, beatmap_id: 999 });
  assert.deepEqual(await attempts(), []);
});

for (const status of ["ongoing", "stopped", "closed"] as const) {
  for (const [label, time, expected] of [
    ["before start", start.getTime() - 1, false],
    ["at start", start.getTime(), false],
    ["after start", start.getTime() + 1, true],
    ["at end", end.getTime(), true],
    ["after end", end.getTime() + 1, status === "ongoing"],
  ] as const) {
    test(`${status} hunt: ${label}`, async () => {
      const hunt = await seedHunt({ status, endedAt: status === "ongoing" ? null : end });
      if (status === "closed") {
        await db.update(bounties).set({ status: "completed", completedAt: end }).where(eq(bounties.id, bountyId));
      }
      await recordDiscoveredScore({ ...evidence, ended_at: new Date(time).toISOString() });
      assert.deepEqual((await attempts()).map(row => row.huntId), expected ? [hunt.id] : []);
    });
  }
}

test("restart gaps are excluded and delayed scores attach to the correct hunt period", async () => {
  const old = await seedHunt({ status: "stopped", endedAt: end });
  const restarted = await seedHunt({ startedAt: new Date("2026-10-16T12:04:00Z") });
  await recordDiscoveredScore({ ...evidence, ended_at: "2026-10-16T12:03:00Z" });
  assert.deepEqual(await attempts(), []);
  await recordDiscoveredScore(evidence);
  await recordDiscoveredScore({ ...evidence, id: evidence.id + 1, ended_at: "2026-10-16T12:05:00Z" });
  const rows = await attempts();
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.scoreId === evidence.id)?.huntId, old.id);
  assert.equal(rows.find(row => row.scoreId === evidence.id + 1)?.huntId, restarted.id);
});

test("offset timestamps are matched by instant", async () => {
  await seedHunt();
  await recordDiscoveredScore({ ...evidence, ended_at: "2026-10-16T14:01:00+02:00" });
  const rows = await attempts();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].scoreEndedAt, new Date(evidence.ended_at));
});

for (const status of ["pending", "valid", "invalid"] as const) {
  test(`rediscovery preserves the entire existing ${status} attempt`, async () => {
    await seedHunt();
    await recordDiscoveredScore(evidence);
    if (status !== "pending") {
      const result: HuntAttemptVerificationResult = {
        playerIsClaimant: true, playerIsNotOwner: true, beatmapIsCorrect: true,
        rulesetIsCorrect: true, scoreIsPassed: true, modsAreCorrect: true,
        scoreIsWithinHuntPeriod: true, gradeIsSatisfied: status === "valid",
      };
      await db.update(huntAttempts).set({ verificationStatus: status,
        verificationResult: result, verifiedAt: discovery });
    }
    const original = await attempts();
    mock.timers.setTime(discovery.getTime() + 60_000);
    await recordDiscoveredScore({ ...evidence, accuracy: 1, rank: "X" });
    assert.deepEqual(await attempts(), original);
  });
}

test("concurrent rediscovery inserts exactly one attempt", async () => {
  await seedHunt();
  await Promise.all([recordDiscoveredScore(evidence), recordDiscoveredScore(evidence)]);
  assert.equal((await attempts()).length, 1);
});

test("a later insert failure rolls back earlier inserts and retry records every match", async () => {
  const first = await seedHunt();
  const second = await seedHunt({ bountyId: await seedBounty() });
  // Fail only once another attempt exists inside this transaction, regardless of query order.
  await db.$client.query(`CREATE FUNCTION test_reject_second_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM hunt_attempts) THEN
        RAISE EXCEPTION 'Forced second attempt failure';
      END IF;
      RETURN NEW;
    END $$`);
  try {
    await db.$client.query("CREATE TRIGGER test_reject_second_attempt BEFORE INSERT ON hunt_attempts FOR EACH ROW EXECUTE FUNCTION test_reject_second_attempt()");
    await assert.rejects(recordDiscoveredScore(evidence), (error: unknown) => {
      const cause = (error as { cause?: Error }).cause;
      assert.match(cause?.message ?? String(error), /Forced second attempt failure/);
      return true;
    });
    assert.deepEqual(await attempts(), []);
  } finally {
    await db.$client.query("DROP TRIGGER IF EXISTS test_reject_second_attempt ON hunt_attempts");
    await db.$client.query("DROP FUNCTION test_reject_second_attempt()");
  }
  await recordDiscoveredScore(evidence);
  assert.deepEqual((await attempts()).map(row => row.huntId).sort(), [first.id, second.id].sort());
});
