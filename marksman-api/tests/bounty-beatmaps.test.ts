import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import type { BountyBeatmapMetadata } from "@marksman/contracts";
import { qualifyingBounty } from "./fixtures/completion";
import { bountyBeatmaps, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { enrichBounty, enrichBounties } = require("../src/services/bounty-enrichment") as typeof import("../src/services/bounty-enrichment");
const { upsertBountyBeatmap, findBeatmapById } = require("../src/db/bounty-beatmaps") as typeof import("../src/db/bounty-beatmaps");
const database = createTestDatabase(db);
let prepared = false;
before(async () => { await database.prepare(); prepared = true; });
beforeEach(async () => { await database.clear(); await db.delete(bountyBeatmaps); });
after(async () => {
  try { if (prepared) { await database.clear(); await db.delete(bountyBeatmaps); } }
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


test("lookup returns undefined for a missing difficulty without creating a row", async () => {
  assert.equal(await findBeatmapById(db, 123), undefined);
  assert.deepEqual(await db.select().from(bountyBeatmaps), []);
});

test("lookup selects the requested ID and serializes the timestamp", async () => {
  const original = await upsertBountyBeatmap(db, metadata);
  await upsertBountyBeatmap(db, { ...metadata, version: { id: 456, name: "Extra" } });
  assert.deepEqual(await findBeatmapById(db, 123), {
    beatmapId: 123, metadata, updatedAt: original.updatedAt.toISOString(),
  });
  await db.transaction(async tx => {
    assert.equal((await findBeatmapById(tx, 456))?.metadata.version.name, "Extra");
  });
});

test("single and list enrichment use stored metadata with no upstream requests, or null when missing", async () => {
  const bounty = qualifyingBounty();
  await db.insert(users).values({ osuUserId: bounty.creatorOsuUserId, username: "Fixture owner", bpBalance: 0 });
  await upsertBountyBeatmap(db, { ...metadata, version: { id: bounty.goal.beatmapId, name: "Stored difficulty" } });
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected upstream request"); });
  try {
    const single = await enrichBounty(bounty);
    assert.equal(single.beatmap?.version.name, "Stored difficulty");
    assert.equal(single.owner?.username, "Fixture owner");
    const [listed] = await enrichBounties([bounty]);
    assert.deepEqual(listed.beatmap, single.beatmap);
    await db.delete(bountyBeatmaps);
    assert.equal((await enrichBounty(bounty)).beatmap, null);
    assert.equal((await enrichBounties([bounty]))[0].beatmap, null);
    assert.equal(fetch.mock.callCount(), 0);
  } finally { fetch.mock.restore(); }
});
