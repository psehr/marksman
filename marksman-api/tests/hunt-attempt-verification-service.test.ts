import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { eq } from "drizzle-orm";
import { huntAttemptScoreEvidenceSchema } from "@marksman/contracts";
import { bounties, bountyHunts, huntAttempts, users, bountySettlements } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
// Replace the read-only transpiled exports with a mutable test dependency before
// loading the service. Each test stubs getBeatmap; live fetch remains blocked.
const beatmapModulePath = require.resolve("../src/integrations/osu/beatmaps");
const originalBeatmapExports = require(beatmapModulePath);
const beatmaps = { ...originalBeatmapExports } as typeof import("../src/integrations/osu/beatmaps");
require.cache[beatmapModulePath]!.exports = beatmaps;
const { verifyHuntAttempt, verifyDueHuntAttempts } = require("../src/services/bounty-hunts-attempts") as typeof import("../src/services/bounty-hunts-attempts");
const { HuntAttemptNotFoundError, InvalidBeatmapMetadataError, OsuApiError, BeatmapNotFoundError } = require("../src/services/errors") as typeof import("../src/services/errors");
const testDatabase = createTestDatabase(db);
const start = new Date("2026-09-21T12:00:00Z");
const end = new Date("2026-09-21T12:02:00Z");
const now = new Date("2026-10-17T12:00:00Z");
let attemptId: string;
let bountyId: string;
let huntId: string;
let upstreamCalls = 0;

before(async () => { await testDatabase.prepare(); });
beforeEach(async () => {
  await testDatabase.clear();
  mock.method(globalThis, "fetch", async () => { upstreamCalls++; throw new Error("Live upstream calls disabled"); });
  const [user] = await db.insert(users).values({ osuUserId: hunter.osuUserId, username: hunter.username }).returning();
  const [bounty] = await db.insert(bounties).values({ creatorOsuUserId: 7, status: "open", rewardBp: 30, goal: qualifyingBounty().goal, createdAt: start }).returning();
  bountyId = bounty.id;
  const [hunt] = await db.insert(bountyHunts).values({ userId: user.id, bountyId, startedAt: start, status: "ongoing" }).returning();
  huntId = hunt.id;
  const scoreEvidence = huntAttemptScoreEvidenceSchema.parse(qualifyingScore());
  const [attempt] = await db.insert(huntAttempts).values({ huntId, scoreId: scoreEvidence.id, scoreEndedAt: new Date(scoreEvidence.ended_at), scoreEvidence, discoveredAt: now, verificationStatus: "pending", nextVerificationAt: now }).returning();
  attemptId = attempt.id;
  mock.timers.enable({ apis: ["Date"], now });
});
afterEach(() => { mock.timers.reset(); mock.restoreAll(); });
after(async () => {
  try { await testDatabase.clearIfMigrated(); assert.equal(upstreamCalls, 0); }
  finally { require.cache[beatmapModulePath]!.exports = originalBeatmapExports; await db.$client.end(); }
});
async function stored() {
  const [row] = await db.select().from(huntAttempts).where(eq(huntAttempts.id, attemptId));
  return row;
}
async function stable() {
  const row = await stored();
  await db.update(huntAttempts).set({ scoreEvidence: { ...row.scoreEvidence, legacy_score_id: 123 } }).where(eq(huntAttempts.id, attemptId));
}

for (const valid of [true, false]) {
  test(`persists ${valid ? "valid" : "invalid"} result and timestamp; retry preserves it`, async () => {
    if (!valid) {
      const row = await stored();
      await db.update(huntAttempts).set({ scoreEvidence: { ...row.scoreEvidence, statistics: { miss: 1 } } }).where(eq(huntAttempts.id, attemptId));
    }
    await db.update(huntAttempts).set({ verificationAttempts: 2, lastVerificationError: "OSU_API_ERROR" }).where(eq(huntAttempts.id, attemptId));
    const lookup = mock.method(beatmaps, "getBeatmap", async () => { throw new Error("Unexpected metadata request"); });
    const result = await verifyHuntAttempt(attemptId);
    assert.ok(result);
    assert.equal(result.verificationStatus, valid ? "valid" : "invalid");
    assert.equal(result.verificationResult?.fcIsSatisfied, valid);
    assert.equal(result.verifiedAt, now.toISOString());
    assert.equal(result.verificationAttempts, 3);
    assert.equal(result.nextVerificationAt, null);
    assert.equal(result.lastVerificationError, null);
    const original = await stored();
    assert.deepEqual(original.verifiedAt, now);
    assert.equal(original.verificationStatus, result.verificationStatus);
    assert.deepEqual(original.verificationResult, JSON.parse(JSON.stringify(result.verificationResult)));
    mock.timers.setTime(now.getTime() + 60000);
    assert.deepEqual(await verifyHuntAttempt(attemptId), result);
    assert.deepEqual(await stored(), original);
    assert.equal(lookup.mock.callCount(), 0);
    const settlements = await db.select().from(bountySettlements);
    assert.deepEqual(settlements, valid ? [{
      bountyId, openedAt: now,
      settleAfter: new Date(now.getTime() + 30_000),
      nextAttemptAt: new Date(now.getTime() + 30_000),
      attempts: 0, lastError: null, settledAt: null,
    }] : []);
  });
}

for (const legacy of [null, 123]) {
  test(`minimum grade skips metadata with legacy score id ${legacy}`, async () => {
    if (legacy) await stable();
    await db.update(bounties).set({ goal: { type: "minimum_grade", beatmapId: metadata.id, beatmapChecksum: null, minimumGradeRequirement: "A", modRequirement: { rule: "any" } } }).where(eq(bounties.id, bountyId));
    const lookup = mock.method(beatmaps, "getBeatmap", async () => { throw new Error("Unexpected metadata request"); });
    const result = await verifyHuntAttempt(attemptId);
    assert.equal(result?.verificationStatus, "valid");
    assert.equal(result?.verificationResult?.gradeIsSatisfied, true);
    assert.equal(lookup.mock.callCount(), 0);
  });
}

test("stable FC fetches metadata outside a transaction", async () => {
  await stable();
  let transactions = 0;
  const originalTransaction = db.transaction.bind(db);
  mock.method(db, "transaction", (...args: Parameters<typeof db.transaction>) => { transactions++; return originalTransaction(...args); });
  const lookup = mock.method(beatmaps, "getBeatmap", async (id: number) => {
    assert.equal(id, metadata.id);
    assert.equal(transactions, 0);
    return metadata;
  });
  assert.equal((await verifyHuntAttempt(attemptId))?.verificationStatus, "valid");
  assert.equal(lookup.mock.callCount(), 1);
});

for (const failure of ["lookup", "invalid metadata"] as const) {
  test(`${failure} schedules increasing retries, then clears retry state on recovery`, async () => {
    await stable();
    const original = await stored();
    const error = new OsuApiError();
    const lookup = mock.method(beatmaps, "getBeatmap", async () => {
      if (failure === "lookup") throw error;
      return { ...metadata, max_combo: 0 };
    });
    let currentTime = now.getTime();
    const delays = [5000, 15000, 60000, 300000, 300000];
    for (const [index, delay] of delays.entries()) {
      await assert.rejects(verifyHuntAttempt(attemptId), failure === "lookup" ? (caught: unknown) => caught === error : InvalidBeatmapMetadataError);
      assert.deepEqual(await stored(), {
        ...original,
        verificationAttempts: index + 1,
        nextVerificationAt: new Date(currentTime + delay),
        lastVerificationError: failure === "lookup" ? "OSU_API_ERROR" : "INVALID_BEATMAP_METADATA_ERROR",
      });
      currentTime += delay;
      mock.timers.setTime(currentTime);
    }
    lookup.mock.mockImplementation(async () => metadata);
    const result = await verifyHuntAttempt(attemptId);
    assert.equal(result?.verificationStatus, "valid");
    assert.equal(result?.verificationAttempts, delays.length + 1);
    assert.equal(result?.nextVerificationAt, null);
    assert.equal(result?.lastVerificationError, null);
    assert.equal(result?.verifiedAt, new Date(currentTime).toISOString());
    const completed = await stored();
    assert.equal(completed.verificationAttempts, delays.length + 1);
    assert.equal(completed.nextVerificationAt, null);
    assert.equal(completed.lastVerificationError, null);
    assert.deepEqual(await verifyHuntAttempt(attemptId), result);
    assert.deepEqual(await stored(), completed);
  });
}

for (const error of [new BeatmapNotFoundError(), new Error("Unexpected failure")]) {
  test(`${error.constructor.name} schedules one five-minute retry and propagates`, async () => {
    await stable();
    const original = await stored();
    mock.method(beatmaps, "getBeatmap", async () => { throw error; });
    await assert.rejects(verifyHuntAttempt(attemptId), (caught: unknown) => caught === error);
    assert.deepEqual(await stored(), {
      ...original,
      verificationAttempts: 1,
      nextVerificationAt: new Date(now.getTime() + 300000),
      lastVerificationError: error instanceof BeatmapNotFoundError ? "BEATMAP_NOT_FOUND" : "UNEXPECTED_ERROR",
    });
  });
}

for (const failure of ["lookup", "invalid metadata"] as const) {
  test(`late ${failure} failure cannot schedule a retry over a completed result`, async () => {
    await stable();
    let release!: () => void;
    let arrived!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { arrived = resolve; });
    let calls = 0;
    const error = new OsuApiError();
    mock.method(beatmaps, "getBeatmap", async () => {
      if (++calls === 1) {
        arrived();
        await gate;
        if (failure === "lookup") throw error;
        return { ...metadata, max_combo: 0 };
      }
      return metadata;
    });
    const delayed = assert.rejects(verifyHuntAttempt(attemptId), failure === "lookup" ? (caught: unknown) => caught === error : InvalidBeatmapMetadataError);
    try {
      await reached;
      assert.equal((await verifyHuntAttempt(attemptId))?.verificationStatus, "valid");
      const completed = await stored();
      assert.equal(completed.verificationAttempts, 1);
      release();
      await delayed;
      assert.deepEqual(await stored(), completed);
    } finally { release(); await delayed; }
  });
}

for (const [huntStatus, bountyStatus] of [["stopped", "open"], ["closed", "completed"], ["closed", "cancelled"]] as const) {
  test(`eligible attempt remains valid for ${huntStatus} hunt and ${bountyStatus} bounty`, async () => {
    await db.update(bountyHunts).set({ status: huntStatus, endedAt: end }).where(eq(bountyHunts.id, huntId));
    await db.update(bounties).set({ status: bountyStatus }).where(eq(bounties.id, bountyId));
    assert.equal((await verifyHuntAttempt(attemptId))?.verificationStatus, "valid");
    assert.equal((await db.select().from(bountySettlements)).length, bountyStatus === "open" ? 1 : 0);
  });
}

test("closure during metadata lookup does not open a settlement", async () => {
  await stable();
  mock.method(beatmaps, "getBeatmap", async () => {
    await db.update(bounties).set({ status: "cancelled" }).where(eq(bounties.id, bountyId));
    await db.update(bountyHunts).set({ status: "closed", endedAt: end }).where(eq(bountyHunts.id, huntId));
    return metadata;
  });
  assert.equal((await verifyHuntAttempt(attemptId))?.verificationStatus, "valid");
  assert.deepEqual(await db.select().from(bountySettlements), []);
});

test("concurrent workers save once without overwriting the winning result", async () => {
  await stable();
  let release!: () => void;
  let arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  let calls = 0;
  mock.method(beatmaps, "getBeatmap", async () => {
    if (++calls === 1) { arrived(); await gate; return { ...metadata, max_combo: 2000 }; }
    return metadata;
  });
  const delayed = verifyHuntAttempt(attemptId);
  try {
    await reached;
    const winner = await verifyHuntAttempt(attemptId);
    assert.equal(winner?.verificationStatus, "valid");
    const original = await stored();
    mock.timers.setTime(now.getTime() + 60000);
    release();
    assert.equal(await delayed, undefined);
    assert.deepEqual(await stored(), original);
  } finally { release(); await delayed; }
});

test("missing attempt produces a specific error", async () => {
  await assert.rejects(verifyHuntAttempt("00000000-0000-4000-8000-000000000000"), HuntAttemptNotFoundError);
});

async function secondDueAttempt() {
  const first = await stored();
  const { id: _id, ...values } = first;
  const scoreId = first.scoreId + 1;
  const [second] = await db.insert(huntAttempts).values({
    ...values, scoreId, scoreEvidence: { ...first.scoreEvidence, id: scoreId },
    nextVerificationAt: now,
  }).returning();
  // Ensure the original attempt is selected first, independent of random UUIDs.
  await db.update(huntAttempts).set({ nextVerificationAt: new Date(now.getTime() - 1) })
    .where(eq(huntAttempts.id, attemptId));
  return second;
}

test("batch returns no failures when no attempts are due", async () => {
  await db.update(huntAttempts).set({ nextVerificationAt: new Date(now.getTime() + 1) });
  assert.deepEqual(await verifyDueHuntAttempts(10), []);
  assert.equal((await stored()).verificationStatus, "pending");
});

test("batch respects its limit and persists success before returning", async () => {
  const second = await secondDueAttempt();
  assert.deepEqual(await verifyDueHuntAttempts(1), []);
  assert.equal((await stored()).verificationStatus, "valid");
  const [untouched] = await db.select().from(huntAttempts).where(eq(huntAttempts.id, second.id));
  assert.equal(untouched.verificationStatus, "pending");
});

for (const error of [new OsuApiError(), new BeatmapNotFoundError(), new Error("Unexpected batch failure")]) {
  test(`batch records ${error.constructor.name} and completes the following attempt`, async () => {
    const second = await secondDueAttempt();
    await stable();
    mock.method(beatmaps, "getBeatmap", async () => { throw error; });
    const failures = await verifyDueHuntAttempts(10);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].attemptId, attemptId);
    assert.equal(failures[0].error, error);
    const first = await stored();
    assert.equal(first.verificationStatus, "pending");
    if (error instanceof OsuApiError) {
      assert.equal(first.verificationAttempts, 1);
      assert.deepEqual(first.nextVerificationAt, new Date(now.getTime() + 5000));
    } else {
      assert.equal(first.verificationAttempts, 1);
      assert.deepEqual(first.nextVerificationAt, new Date(now.getTime() + 300000));
    }
    const [completed] = await db.select().from(huntAttempts).where(eq(huntAttempts.id, second.id));
    assert.equal(completed.verificationStatus, "valid");
  });
}

test("batch verifies sequentially and waits for the final attempt", { timeout: 5000 }, async () => {
  await stable();
  const second = await secondDueAttempt();
  let release!: () => void;
  let arrived!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { arrived = resolve; });
  let calls = 0;
  let firstStatusAtSecondLookup: string | undefined;
  mock.method(beatmaps, "getBeatmap", async () => {
    if (++calls === 2) {
      firstStatusAtSecondLookup = (await stored()).verificationStatus;
      arrived();
      await gate;
    }
    return metadata;
  });
  let finished = false;
  const batch = verifyDueHuntAttempts(10).then(result => { finished = true; return result; });
  try {
    await reached;
    assert.equal(firstStatusAtSecondLookup, "valid");
    assert.equal(finished, false);
    release();
    assert.deepEqual(await batch, []);
    const [completed] = await db.select().from(huntAttempts).where(eq(huntAttempts.id, second.id));
    assert.equal(completed.verificationStatus, "valid");
    assert.equal(calls, 2);
  } finally { release(); await batch; }
});

test("batch propagates an initial query failure", async () => {
  const error = new Error("Database query failed");
  const select = mock.method(db, "select", () => { throw error; });
  await assert.rejects(verifyDueHuntAttempts(10), (caught: unknown) => caught === error);
  assert.equal(select.mock.callCount(), 1);
  select.mock.restore();
  assert.equal((await stored()).verificationStatus, "pending");
});

test("unexpected record-loading failure schedules one fallback retry", async () => {
  const error = new Error("Hunt lookup failed");
  const originalSelect = db.select.bind(db);
  let calls = 0;
  const select = mock.method(db, "select", (...args: Parameters<typeof db.select>) => {
    if (++calls === 2) throw error;
    return originalSelect(...args);
  });
  await assert.rejects(verifyHuntAttempt(attemptId), (caught: unknown) => caught === error);
  select.mock.restore();
  const row = await stored();
  assert.equal(row.verificationStatus, "pending");
  assert.equal(row.verificationAttempts, 1);
  assert.equal(row.lastVerificationError, "UNEXPECTED_ERROR");
  assert.deepEqual(row.nextVerificationAt, new Date(now.getTime() + 300000));
});

test("transaction rejection schedules a fallback retry", async () => {
  const error = new Error("Transaction failed");
  mock.method(db, "transaction", async () => { throw error; });
  await assert.rejects(verifyHuntAttempt(attemptId), (caught: unknown) => caught === error);
  const row = await stored();
  assert.equal(row.verificationStatus, "pending");
  assert.equal(row.verificationAttempts, 1);
  assert.equal(row.lastVerificationError, "UNEXPECTED_ERROR");
  assert.deepEqual(row.nextVerificationAt, new Date(now.getTime() + 300000));
});

test("retry-write failure propagates without attempting to schedule again", async () => {
  await stable();
  mock.method(beatmaps, "getBeatmap", async () => { throw new OsuApiError(); });
  const error = new Error("Retry write failed");
  const update = mock.method(db, "update", () => { throw error; });
  await assert.rejects(verifyHuntAttempt(attemptId), (caught: unknown) => caught === error);
  assert.equal(update.mock.callCount(), 1);
  assert.equal((await stored()).verificationAttempts, 0);
});
