import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { scoreDiscoveryCursors } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { findCursorByStream, upsertCursor } = require("../src/db/score-discovery-cursors") as typeof import("../src/db/score-discovery-cursors");
const testDatabase = createTestDatabase(db);

before(() => testDatabase.prepare());
beforeEach(() => testDatabase.clear());
after(async () => {
  try { await testDatabase.clearIfMigrated(); }
  finally { await db.$client.end(); }
});

const read = (stream: string) => db.transaction(tx => findCursorByStream(tx, stream));
const save = (stream: string, cursor: string) => db.transaction(tx => upsertCursor(tx, stream, cursor));

test("missing stream returns undefined without creating a row", async () => {
  assert.equal(await read("osu-standard"), undefined);
  assert.deepEqual(await db.select().from(scoreDiscoveryCursors), []);
});

test("first upsert persists an opaque cursor and returns the saved row", async () => {
  const cursor = "opaque+/=&?# %cursor";
  const beforeSave = Date.now();
  const row = await save("osu-standard", cursor);
  const afterSave = Date.now();
  assert.equal(row.stream, "osu-standard");
  assert.equal(row.cursor, cursor);
  assert.ok(row.updatedAt instanceof Date);
  assert.ok(row.updatedAt.getTime() >= beforeSave && row.updatedAt.getTime() <= afterSave);
  assert.equal(await read("osu-standard"), cursor);
  assert.deepEqual(await db.select().from(scoreDiscoveryCursors), [row]);
});

for (const cursor of ["new-cursor", "original-cursor"]) {
  test(`upsert refreshes timestamp without duplicating the stream (${cursor})`, async () => {
    const oldTime = new Date("2020-01-01T00:00:00Z");
    await db.insert(scoreDiscoveryCursors).values({
      stream: "osu-standard", cursor: "original-cursor", updatedAt: oldTime,
    });
    const beforeSave = Date.now();
    const row = await save("osu-standard", cursor);
    const afterSave = Date.now();
    assert.equal(row.cursor, cursor);
    assert.ok(row.updatedAt.getTime() >= beforeSave && row.updatedAt.getTime() <= afterSave);
    assert.equal(await read("osu-standard"), cursor);
    assert.deepEqual(await db.select().from(scoreDiscoveryCursors), [row]);
  });
}

test("streams remain independent even when they share the same cursor", async () => {
  await save("osu-standard", "shared-cursor");
  const other = await save("osu-mania", "shared-cursor");
  await save("osu-standard", "next-cursor");
  assert.equal(await read("osu-standard"), "next-cursor");
  assert.equal(await read("osu-mania"), "shared-cursor");
  assert.equal(await read("unknown"), undefined);
  const rows = await db.select().from(scoreDiscoveryCursors);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find(row => row.stream === "osu-mania"), other);
});

test("cursor changes roll back with the caller's transaction", async () => {
  const original = await save("osu-standard", "original-cursor");
  const error = new Error("Abort discovery cycle");
  await assert.rejects(db.transaction(async tx => {
    await upsertCursor(tx, "osu-standard", "uncommitted-cursor");
    await upsertCursor(tx, "osu-mania", "uncommitted-insert");
    assert.equal(await findCursorByStream(tx, "osu-standard"), "uncommitted-cursor");
    throw error;
  }), caught => caught === error);
  assert.equal(await read("osu-standard"), "original-cursor");
  assert.equal(await read("osu-mania"), undefined);
  assert.deepEqual(await db.select().from(scoreDiscoveryCursors), [original]);
});
