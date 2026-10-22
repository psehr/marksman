import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { eq } from "drizzle-orm";
import { huntAttemptScoreEvidenceSchema } from "@marksman/contracts";
import { bounties, bountyHunts, huntAttempts, users, scoreDiscoveryCursors, ledgerEntries, bountySettlements } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
// Only HTTP is mocked: use the real fetcher, parser, discovery, DB queries,
// transactions, due-attempt selection, verifier, and result persistence.
const { db } = require("../src/db") as typeof import("../src/db");
const { discoverScores, isDiscoveryHealthy } = require("../src/services/hunt-discovery") as typeof import("../src/services/hunt-discovery");
const { startHunt } = require("../src/services/bounty-hunts") as typeof import("../src/services/bounty-hunts");
const { settleDueBounties } = require("../src/services/bounty-settlements") as typeof import("../src/services/bounty-settlements");
const { verifyDueHuntAttempts } = require("../src/services/bounty-hunts-attempts") as typeof import("../src/services/bounty-hunts-attempts");
const fixture = createTestDatabase(db);
let payload: unknown[];
let cursors: (string | null)[];
let metadataCalls: number;
let bountyId: string;
let huntId: string;
let userId: string;
let originalBalance: number;
let feedUnavailable = false;
const score = qualifyingScore();

before(() => fixture.prepare());
beforeEach(async () => {
  await fixture.clear();
  payload = []; cursors = []; metadataCalls = 0;
  feedUnavailable = false;
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://osu.ppy.sh");
    if (url.pathname === "/oauth/token") {
      return Response.json({ access_token: "pipeline-fixture-token", token_type: "Bearer", expires_in: 3600 });
    }
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer pipeline-fixture-token");
    if (url.pathname === "/api/v2/scores") {
      if (feedUnavailable) return new Response(null, { status: 503 });
      assert.equal(url.searchParams.get("ruleset"), "osu");
      const cursor = url.searchParams.get("cursor_string");
      cursors.push(cursor);
      if (cursor === null) return Response.json({ scores: [score], cursor_string: "boundary" });
      assert.ok(cursor === "boundary" || cursor === "next");
      return Response.json({ scores: payload, cursor_string: "next" });
    }
    if (url.pathname === `/api/v2/beatmaps/${metadata.id}`) {
      metadataCalls++;
      return Response.json(metadata);
    }
    throw new Error(`Unexpected mocked request: ${url.pathname}`);
  });
});
afterEach(() => { mock.timers.reset(); mock.restoreAll(); });
after(async () => {
  try { await fixture.clearIfMigrated(); }
  finally { await db.$client.end(); }
});

async function seedHunt(useService = false) {
  const [user] = await db.insert(users).values({ osuUserId: hunter.osuUserId, username: hunter.username }).returning();
  userId = user.id; originalBalance = user.bpBalance;
  const [bounty] = await db.insert(bounties).values({
    creatorOsuUserId: 7, status: "open", rewardBp: 30, goal: qualifyingBounty().goal,
    createdAt: new Date("2026-09-21T11:59:00Z"),
  }).returning();
  bountyId = bounty.id;
  if (useService) {
    const hunt = await startHunt({ ...hunter, id: userId }, bountyId);
    huntId = hunt.id;
    return;
  }
  const [hunt] = await db.insert(bountyHunts).values({
    userId, bountyId, startedAt: new Date("2026-09-21T12:00:00Z"), status: "ongoing",
  }).returning();
  huntId = hunt.id;
}
const attempts = () => db.select().from(huntAttempts).orderBy(huntAttempts.scoreId);
const cursor = async () => (await db.select().from(scoreDiscoveryCursors))[0]?.cursor;

async function assertNoSettlement() {
  const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
  assert.equal(bounty.status, "open");
  assert.equal(bounty.completedAt, null);
  assert.equal(bounty.completedByOsuUserId, null);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  assert.equal(user.bpBalance, originalBalance);
  assert.deepEqual(await db.select().from(ledgerEntries), []);
}

test("HTTP discovery persists matching attempts, verifies stable/lazer evidence, and safely replays", async () => {
  // Establish the initial boundary before accepting any hunts.
  await discoverScores();
  assert.deepEqual(cursors, [null, "boundary"]);
  assert.equal(await cursor(), "next");
  assert.deepEqual(await attempts(), []);
  await seedHunt();
  const stable = { ...score, id: score.id + 1, legacy_score_id: 123 };
  const invalid = { ...score, id: score.id + 2, statistics: { miss: 1 } };
  const failed = { ...score, id: score.id + 6, passed: false, rank: "F" };
  payload = [score, stable, invalid, score,
    { ...score, id: score.id + 3, user_id: 999 },
    { ...score, id: score.id + 4, beatmap_id: 999 },
    { ...score, id: score.id + 5, ended_at: "2026-09-21T12:00:00Z" },
    failed,
  ];
  await discoverScores();
  const pending = await attempts();
  assert.deepEqual(pending.map(row => row.scoreId), [score.id, stable.id, invalid.id, failed.id]);
  for (const row of pending) {
    assert.equal(row.huntId, huntId);
    assert.equal(row.verificationStatus, "pending");
    assert.equal(row.verificationAttempts, 0);
    assert.deepEqual(row.nextVerificationAt, row.discoveredAt);
    assert.deepEqual(row.scoreEvidence, huntAttemptScoreEvidenceSchema.parse(payload.find(item => (item as { id: number }).id === row.scoreId)));
  }
  assert.deepEqual(await verifyDueHuntAttempts(20), []);
  const verified = await attempts();
  assert.deepEqual(verified.map(row => row.verificationStatus), ["valid", "valid", "invalid", "invalid"]);
  assert.equal(metadataCalls, 1);
  for (const row of verified) {
    assert.equal(row.verificationAttempts, 1);
    assert.ok(row.verifiedAt instanceof Date);
    assert.equal(row.nextVerificationAt, null);
    assert.equal(row.lastVerificationError, null);
    assert.equal(row.verificationResult?.fcIsSatisfied, row.scoreId !== invalid.id);
  }
  await discoverScores();
  assert.deepEqual(await verifyDueHuntAttempts(20), []);
  assert.deepEqual(await attempts(), verified);
  await assertNoSettlement();
});

async function prepareAutomaticFlow(stable = false) {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-21T12:00:00Z") });
  await discoverScores();
  await seedHunt(true);
  mock.timers.setTime(Date.parse("2026-09-21T12:01:01Z"));
  payload = [{ ...score, legacy_score_id: stable ? 123 : null }];
  await discoverScores();
  assert.equal((await attempts())[0].verificationStatus, "pending");
  assert.deepEqual(await settleDueBounties(20), []);
  await assertNoSettlement();
  assert.deepEqual(await db.select().from(bountySettlements), []);
  assert.deepEqual(await verifyDueHuntAttempts(20), []);
  assert.equal((await attempts())[0].verificationStatus, "valid");
  const [settlement] = await db.select().from(bountySettlements);
  assert.equal(settlement.settleAfter.getTime(), Date.now() + 30000);
  assert.equal(settlement.settledAt, null);
  return settlement;
}

async function assertAutomaticPayout() {
  const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId));
  assert.equal(bounty.status, "completed");
  assert.equal(bounty.completedByOsuUserId, hunter.osuUserId);
  assert.equal(bounty.completionScoreId, score.id);
  assert.equal(bounty.completedAt?.getTime(), Date.now());
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  assert.equal(user.bpBalance, originalBalance + 30);
  const ledger = await db.select().from(ledgerEntries);
  assert.equal(ledger.length, 1);
  assert.deepEqual([ledger[0].reason, ledger[0].userId, ledger[0].bountyId, ledger[0].amount],
    ["bounty_reward", userId, bountyId, 30]);
  const [hunt] = await db.select().from(bountyHunts).where(eq(bountyHunts.id, huntId));
  assert.equal(hunt.status, "closed");
  assert.deepEqual(hunt.endedAt, bounty.completedAt);
  const [settlement] = await db.select().from(bountySettlements);
  assert.equal(settlement.settledAt?.getTime(), Date.now());
  assert.equal(settlement.attempts, 0);
  assert.equal(settlement.lastError, null);
}

for (const stable of [false, true]) {
  test(`automatic ${stable ? "stable" : "lazer"} flow waits 30 seconds, pays and tolerates replay`, async () => {
    const settlement = await prepareAutomaticFlow(stable);
    mock.timers.setTime(settlement.settleAfter.getTime() - 1);
    assert.deepEqual(await settleDueBounties(20), []);
    await assertNoSettlement();
    mock.timers.setTime(settlement.settleAfter.getTime());
    assert.deepEqual(await settleDueBounties(20), []);
    await assertAutomaticPayout();
    await discoverScores();
    assert.deepEqual(await verifyDueHuntAttempts(20), []);
    assert.deepEqual(await settleDueBounties(20), []);
    assert.equal((await attempts()).length, 1);
    await assertAutomaticPayout();
  });
}

for (const failure of ["HTTP failure", "malformed batch"] as const) {
  test(`${failure} pauses due settlement; discovery recovery permits overdue payout`, async () => {
    const settlement = await prepareAutomaticFlow();
    mock.timers.setTime(settlement.settleAfter.getTime() + 10000);
    feedUnavailable = failure === "HTTP failure";
    if (failure === "malformed batch") payload = [score, null];
    await assert.rejects(discoverScores());
    assert.equal(isDiscoveryHealthy(), false);
    assert.deepEqual(await settleDueBounties(20), []);
    await assertNoSettlement();
    assert.deepEqual(await db.select().from(bountySettlements), [settlement]);
    feedUnavailable = false;
    payload = [score];
    await discoverScores();
    assert.equal(isDiscoveryHealthy(), true);
    assert.deepEqual(await verifyDueHuntAttempts(20), []);
    assert.deepEqual(await settleDueBounties(20), []);
    await assertAutomaticPayout();
    assert.equal((await db.select().from(bountySettlements))[0].settleAfter.getTime(), settlement.settleAfter.getTime());
  });
}

test("malformed batch keeps cursor; retry deduplicates persisted evidence and reaches verification", async () => {
  await db.insert(scoreDiscoveryCursors).values({ stream: "osu-standard", cursor: "boundary" });
  await seedHunt();
  payload = [score, null];
  await assert.rejects(discoverScores(), /1 rejected scores/);
  assert.equal(await cursor(), "boundary");
  assert.equal((await attempts()).length, 1);
  payload = [score];
  await discoverScores();
  assert.deepEqual(cursors, ["boundary", "boundary"]);
  assert.equal(await cursor(), "next");
  assert.equal((await attempts()).length, 1);
  assert.deepEqual(await verifyDueHuntAttempts(20), []);
  assert.equal((await attempts())[0].verificationStatus, "valid");
  await assertNoSettlement();
});
