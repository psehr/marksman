import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createBountySchema } from "@marksman/contracts";
import * as schema from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

const pool = new Pool({ connectionString: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test" });
const db = drizzle({ client: pool, schema });
const database = createTestDatabase(db);
const migration = readFileSync(resolve(__dirname, "../drizzle/0023_mod_settings.sql"), "utf8");
before(() => database.prepare());
beforeEach(() => database.clear());
after(async () => {
  try { await database.clearIfMigrated(); } finally { await pool.end(); }
});

async function seed(requirement: unknown, status = "open") {
  const id = randomUUID();
  const goal = {
    type: "full_combo", beatmapId: 123, beatmapChecksum: "a".repeat(32),
    minimumAccuracy: 98, minimumComboRatio: 0.99,
    ...(requirement === undefined ? {} : { modRequirement: requirement }),
  };
  await pool.query(
    "INSERT INTO bounties (id, status, reward_bp, creator_osu_user_id, goal) VALUES ($1,$2,100,42,$3)",
    [id, status, JSON.stringify(goal)],
  );
  return { id, goal, status };
}

test("migration preserves legacy rule meanings, goal fields and all bounty statuses", async () => {
  const cases = [
    [{ rule: "any" }, { required: [], forbidden: [], allowOtherMods: true }, "open"],
    [{ rule: "exact", mods: [] }, { required: [], forbidden: [], allowOtherMods: false }, "completed"],
    [{ rule: "exact", mods: ["HD", "HR"] }, { required: ["HD", "HR"], forbidden: [], allowOtherMods: false }, "cancelled"],
    [{ rule: "includes", mods: ["HD"] }, { required: ["HD"], forbidden: [], allowOtherMods: true }, "draft"],
    [{ rule: "excludes", mods: ["HT"] }, { required: [], forbidden: ["HT"], allowOtherMods: true }, "open"],
    [undefined, { required: [], forbidden: [], allowOtherMods: true }, "open"],
    [{ required: ["HD"], forbidden: ["HT"], allowOtherMods: true }, { required: ["HD"], forbidden: ["HT"], allowOtherMods: true }, "open"],
  ] as const;
  const rows = [];
  for (const [legacy, expected, status] of cases) rows.push({ ...await seed(legacy, status), expected });
  await pool.query(migration);
  for (const row of rows) {
    const result = (await pool.query("SELECT goal, status, reward_bp FROM bounties WHERE id=$1", [row.id])).rows[0];
    assert.deepEqual(result.goal, { ...row.goal, modRequirement: row.expected });
    assert.equal(result.status, row.status);
    assert.equal(result.reward_bp, 100);
    assert.equal(createBountySchema.safeParse({ rewardBp: 100, goal: result.goal }).success, true);
  }
  const before = (await pool.query("SELECT * FROM bounties ORDER BY id")).rows;
  await pool.query(migration);
  assert.deepEqual((await pool.query("SELECT * FROM bounties ORDER BY id")).rows, before);
});

for (const requirement of [{ rule: "unknown" }, { rule: "includes", mods: ["SO"] }]) {
  test(`migration rejects unexpected legacy data: ${JSON.stringify(requirement)}`, async () => {
    const row = await seed(requirement);
    await assert.rejects(pool.query(migration), /Unsupported legacy mod requirements/);
    assert.deepEqual((await pool.query("SELECT goal FROM bounties WHERE id=$1", [row.id])).rows[0].goal, row.goal);
  });
}
