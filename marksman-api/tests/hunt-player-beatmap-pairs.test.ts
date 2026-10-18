import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { bounties, bountyHunts, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { qualifyingScore } from "./fixtures/completion";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { findHuntPlayerBeatmapPairs } = require("../src/db/bounty-hunts") as typeof import("../src/db/bounty-hunts");
const { filterScoresForHunts } = require("../src/services/bounty-hunts-attempts") as typeof import("../src/services/bounty-hunts-attempts");
const testDatabase = createTestDatabase(db);
let playerIds: string[];
const start = new Date("2026-10-18T12:00:00Z");
const end = new Date("2026-10-18T12:01:00Z");

before(() => testDatabase.prepare());
beforeEach(async () => {
  await testDatabase.clear();
  const rows = await db.insert(users).values([
    { osuUserId: 102, username: "hunter" },
    { osuUserId: 103, username: "other" },
  ]).returning();
  playerIds = [102, 103].map(id => rows.find(row => row.osuUserId === id)!.id);
});
after(async () => {
  try { await testDatabase.clearIfMigrated(); }
  finally { await db.$client.end(); }
});

async function seedBounty(beatmapId: number, status: "open" | "cancelled" | "completed" = "open") {
  const [row] = await db.insert(bounties).values({
    creatorOsuUserId: 101, status, rewardBp: 30,
    goal: { type: "minimum_grade", beatmapId, minimumGradeRequirement: "A",
      beatmapChecksum: null, modRequirement: { rule: "any" } },
  }).returning();
  return row.id;
}
async function seedHunt(userId: string, bountyId: string, status: "ongoing" | "stopped" | "closed" = "ongoing") {
  await db.insert(bountyHunts).values({
    userId, bountyId, status, startedAt: start, endedAt: status === "ongoing" ? null : end,
  });
}

test("requires both player and beatmap filters and returns numeric IDs", async () => {
  const map123 = await seedBounty(123);
  const map456 = await seedBounty(456);
  await seedHunt(playerIds[0], map123);
  await seedHunt(playerIds[1], map123);
  await seedHunt(playerIds[0], map456);
  assert.deepEqual(await findHuntPlayerBeatmapPairs(db, [102], [123]), [
    { osuUserId: 102, beatmapId: 123 },
  ]);
});

test("deduplicates repeated hunt periods, multiple bounties and repeated input IDs", async () => {
  const bounty = await seedBounty(123);
  await seedHunt(playerIds[0], bounty, "stopped");
  await seedHunt(playerIds[0], bounty);
  await seedHunt(playerIds[0], await seedBounty(123));
  assert.deepEqual(await findHuntPlayerBeatmapPairs(db, [102, 102], [123, 123]), [
    { osuUserId: 102, beatmapId: 123 },
  ]);
});

for (const status of ["ongoing", "stopped", "closed"] as const) {
  test(`includes ${status} hunt pairs`, async () => {
    const bounty = await seedBounty(123, status === "closed" ? "cancelled" : "open");
    await seedHunt(playerIds[0], bounty, status);
    assert.deepEqual(await findHuntPlayerBeatmapPairs(db, [102], [123]), [
      { osuUserId: 102, beatmapId: 123 },
    ]);
  });
}

test("returns only existing pairs across multiple players and difficulties", async () => {
  await seedHunt(playerIds[0], await seedBounty(123));
  await seedHunt(playerIds[1], await seedBounty(456));
  const pairs = await findHuntPlayerBeatmapPairs(db, [102, 103], [123, 456]);
  assert.deepEqual(pairs.sort((a, b) => a.osuUserId - b.osuUserId), [
    { osuUserId: 102, beatmapId: 123 }, { osuUserId: 103, beatmapId: 456 },
  ]);
});

test("returns no pairs for unmatched IDs or a bounty with no hunts", async () => {
  await seedBounty(123);
  assert.deepEqual(await findHuntPlayerBeatmapPairs(db, [102], [123]), []);
  await seedHunt(playerIds[0], await seedBounty(456));
  assert.deepEqual(await findHuntPlayerBeatmapPairs(db, [999], [456]), []);
  assert.deepEqual(await findHuntPlayerBeatmapPairs(db, [102], [999]), []);
});

test("empty filters return without accessing the database", async () => {
  const unusedConnection = new Proxy(db, {
    get() { throw new Error("Empty filters must not access the database"); },
  });
  assert.deepEqual(await findHuntPlayerBeatmapPairs(unusedConnection, [], [123]), []);
  assert.deepEqual(await findHuntPlayerBeatmapPairs(unusedConnection, [102], []), []);
  assert.deepEqual(await findHuntPlayerBeatmapPairs(unusedConnection, [], []), []);
});

test("accepts a transaction connection", async () => {
  await seedHunt(playerIds[0], await seedBounty(123));
  const pairs = await db.transaction(tx => findHuntPlayerBeatmapPairs(tx, [102], [123]));
  assert.deepEqual(pairs, [{ osuUserId: 102, beatmapId: 123 }]);
});

function score(id: number, userId: number, beatmapId: number) {
  const { beatmap, beatmapset, ...evidence } = qualifyingScore();
  return { ...evidence, id, user_id: userId, beatmap_id: beatmapId };
}

test("batch filter keeps exact pairs in input order and rejects crossed combinations", async () => {
  await seedHunt(playerIds[0], await seedBounty(123));
  await seedHunt(playerIds[1], await seedBounty(456));
  const scores = [
    score(1, 103, 456), score(2, 102, 456), score(3, 103, 123),
    score(4, 102, 123), score(5, 999, 123), score(6, 102, 999),
  ];
  const original = structuredClone(scores);
  assert.deepEqual(await filterScoresForHunts(scores), [scores[0], scores[3]]);
  assert.deepEqual(scores, original);
});

test("batch filter preserves multiple scores and duplicate evidence for a matching pair", async () => {
  await seedHunt(playerIds[0], await seedBounty(123));
  const first = score(1, 102, 123);
  const second = score(2, 102, 123);
  assert.deepEqual(await filterScoresForHunts([first, second, first]), [first, second, first]);
});

test("batch filter retains historical pairs without applying time or requirement checks", async () => {
  await seedHunt(playerIds[0], await seedBounty(123), "stopped");
  await seedHunt(playerIds[1], await seedBounty(456, "completed"), "closed");
  const scores = [
    { ...score(1, 102, 123), ended_at: "2026-10-18T12:00:30Z", rank: "D" as const },
    { ...score(2, 103, 456), ended_at: "2026-10-18T12:00:30Z" },
    { ...score(3, 102, 123), ended_at: "2026-10-18T13:00:00Z" },
  ];
  // Exact period and eligibility checks belong to later discovery/verification.
  assert.deepEqual(await filterScoresForHunts(scores), scores);
});

test("batch filter returns no scores when no exact pair matches", async () => {
  await seedHunt(playerIds[0], await seedBounty(123));
  assert.deepEqual(await filterScoresForHunts([score(1, 103, 123), score(2, 102, 456)]), []);
});

test("batch filter accepts an empty batch", async () => {
  assert.deepEqual(await filterScoresForHunts([]), []);
});
