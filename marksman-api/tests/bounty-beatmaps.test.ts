import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { BountyBeatmapMetadata } from "@marksman/contracts";
import { bountyBeatmaps } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { upsertBountyBeatmap } = require("../src/db/bounty-beatmaps") as typeof import("../src/db/bounty-beatmaps");
const database = createTestDatabase(db);
let prepared = false;
before(async () => { await database.prepare(); prepared = true; });
beforeEach(async () => { await db.delete(bountyBeatmaps); });
after(async () => {
  try { if (prepared) await db.delete(bountyBeatmaps); }
  finally { await db.$client.end(); }
});
const metadata: BountyBeatmapMetadata = {
  url: "https://osu.ppy.sh/beatmaps/123", version: { id: 123, name: "Hard" },
  song: { title: "Fixture song", artist: "Fixture artist" },
  specs: { sr: 4, ar: 9, od: 8, cs: 4, hp: 5, bpm: null,
    length: { total: 120, drain: 110 }, maxCombo: 500 },
  covers: null, creator: null, stats: { status: "ranked", playcount: 10 },
};

test("inserts validated metadata with the difficulty ID and fetch timestamp", async () => {
  const start = Date.now();
  const row = await upsertBountyBeatmap(db, metadata);
  assert.equal(row.beatmapId, 123);
  assert.deepEqual(row.metadata, metadata);
  assert.ok(row.updatedAt.getTime() >= start && row.updatedAt.getTime() <= Date.now());
  assert.deepEqual(await db.select().from(bountyBeatmaps), [row]);
});

test("replaces metadata and refreshes timestamp without duplicating the beatmap", async () => {
  await db.insert(bountyBeatmaps).values({ beatmapId: 123, metadata, updatedAt: new Date("2020-01-01Z") });
  const replacement = { ...metadata, song: { title: "Updated", artist: "New artist" } };
  const start = Date.now();
  const row = await upsertBountyBeatmap(db, replacement);
  assert.deepEqual(row.metadata, replacement);
  assert.ok(row.updatedAt.getTime() >= start);
  assert.deepEqual(await db.select().from(bountyBeatmaps), [row]);
});

test("invalid metadata is rejected before any database write", async () => {
  await assert.rejects(upsertBountyBeatmap(db, { ...metadata, song: { title: "", artist: "Artist" } }));
  assert.deepEqual(await db.select().from(bountyBeatmaps), []);
});

test("upserts participate in the caller's transaction and leave other beatmaps unchanged", async () => {
  const original = await upsertBountyBeatmap(db, metadata);
  const abort = new Error("rollback");
  await assert.rejects(db.transaction(async tx => {
    await upsertBountyBeatmap(tx, { ...metadata, song: null });
    await upsertBountyBeatmap(tx, { ...metadata, version: { id: 456, name: "Extra" } });
    throw abort;
  }), error => error === abort);
  assert.deepEqual(await db.select().from(bountyBeatmaps), [original]);
  await upsertBountyBeatmap(db, { ...metadata, version: { id: 456, name: "Extra" } });
  const rows = await db.select().from(bountyBeatmaps);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find(row => row.beatmapId === 123), original);
});
