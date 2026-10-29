import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { bounties, bountyBeatmaps } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { metadata, qualifyingBounty } from "./fixtures/completion";
import { toBountyBeatmapMetadata } from "../src/adapters/beatmap";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { backfillBeatmaps } = require("../src/scripts/backfill-beatmaps") as typeof import("../src/scripts/backfill-beatmaps");
const database = createTestDatabase(db);
let prepared = false;
before(async () => { await database.prepare(); prepared = true; });
beforeEach(async () => { await database.clear(); await db.delete(bountyBeatmaps); });
after(async () => {
  try {
    if (prepared) { await database.clear(); await db.delete(bountyBeatmaps); }
  } finally { await db.$client.end(); }
});
const quiet = () => {};
async function seed(id: number, status: "open" | "completed" | "cancelled" = "open") {
  const bounty = qualifyingBounty();
  await db.insert(bounties).values({ rewardBp: bounty.rewardBp, creatorOsuUserId: bounty.creatorOsuUserId, createdAt: new Date(bounty.createdAt),
    goal: { ...bounty.goal, beatmapId: id }, status });
}

test("empty database performs no upstream requests", async () => {
  const result = await backfillBeatmaps(db, async () => { throw new Error("Unexpected fetch"); }, quiet);
  assert.deepEqual(result, { saved: 0, skipped: 0, failedIds: [] });
});

test("deduplicates difficulties across all statuses and a rerun leaves timestamps unchanged", async () => {
  await seed(123); await seed(123, "completed"); await seed(456, "cancelled");
  const beforeBounties = await db.select().from(bounties).orderBy(bounties.id);
  const calls: number[] = [];
  const fetch = async (id: number) => { calls.push(id); return { ...metadata, id }; };
  assert.deepEqual(await backfillBeatmaps(db, fetch, quiet), { saved: 2, skipped: 0, failedIds: [] });
  assert.deepEqual(calls, [123, 456]);
  const stored = await db.select().from(bountyBeatmaps).orderBy(bountyBeatmaps.beatmapId);
  assert.deepEqual(stored[0].metadata, toBountyBeatmapMetadata({ ...metadata, id: 123 }));
  calls.length = 0;
  assert.deepEqual(await backfillBeatmaps(db, fetch, quiet), { saved: 0, skipped: 0, failedIds: [] });
  assert.deepEqual(calls, []);
  assert.deepEqual(await db.select().from(bountyBeatmaps).orderBy(bountyBeatmaps.beatmapId), stored);
  assert.deepEqual(await db.select().from(bounties).orderBy(bounties.id), beforeBounties);
});

test("continues after failures and retries only missing IDs on rerun", async () => {
  for (const id of [123, 456, 789]) await seed(id);
  const logs: string[] = [];
  const first = await backfillBeatmaps(db, async id => {
    if (id === 456) throw new Error("Upstream unavailable");
    return { ...metadata, id };
  }, message => logs.push(message));
  assert.deepEqual(first, { saved: 2, skipped: 0, failedIds: [456] });
  assert.ok(logs.includes("Failed IDs: 456"));
  const calls: number[] = [];
  const second = await backfillBeatmaps(db, async id => { calls.push(id); return { ...metadata, id }; }, quiet);
  assert.deepEqual(second, { saved: 1, skipped: 0, failedIds: [] });
  assert.deepEqual(calls, [456]);
});

test("rejects mismatched IDs and malformed metadata without persisting them", async () => {
  await seed(123); await seed(456);
  const result = await backfillBeatmaps(db, async id => ({ ...metadata,
    id: id === 123 ? 999 : id, version: id === 456 ? "" : "Hard" }), quiet);
  assert.deepEqual(result.failedIds, [123, 456]);
  assert.deepEqual(await db.select().from(bountyBeatmaps), []);
});

test("preserves metadata inserted by creation while the upstream request is pending", async () => {
  await seed(123);
  const fresher = toBountyBeatmapMetadata({ ...metadata, id: 123, version: "Fresher" });
  const result = await backfillBeatmaps(db, async id => {
    await db.insert(bountyBeatmaps).values({ beatmapId: id, metadata: fresher });
    return { ...metadata, id };
  }, quiet);
  assert.deepEqual(result, { saved: 0, skipped: 1, failedIds: [] });
  const [row] = await db.select().from(bountyBeatmaps);
  assert.deepEqual(row.metadata, fresher);
});
