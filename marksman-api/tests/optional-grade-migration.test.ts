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
const migration = readFileSync(resolve(__dirname, "../drizzle/0024_optional_minimum_grade.sql"), "utf8");
before(() => database.prepare());
beforeEach(() => database.clear());
after(async () => {
  try { await database.clearIfMigrated(); } finally { await pool.end(); }
});

test("migration converts legacy grades across statuses, preserves other fields and is repeatable", async () => {
  for (const status of ["open", "completed", "cancelled", "draft"]) {
    for (const required of [[], ["NF"], ["HD", "NF", "HR"]]) {
      const id = randomUUID();
      const goal = {
        type: "minimum_grade", minimumGradeRequirement: "SH",
        beatmapId: 123, beatmapChecksum: "a".repeat(32), minimumAccuracy: 98,
        modRequirement: { required, forbidden: ["HT"], allowOtherMods: true },
      };
      await pool.query(
        "INSERT INTO bounties (id,status,reward_bp,creator_osu_user_id,goal) VALUES ($1,$2,100,42,$3)",
        [id, status, JSON.stringify(goal)],
      );
      await pool.query(migration);
      const row = (await pool.query("SELECT * FROM bounties WHERE id=$1", [id])).rows[0];
      const { minimumGradeRequirement, ...rest } = goal;
      assert.deepEqual(row.goal, {
        ...rest, type: "pass", minimumGrade: minimumGradeRequirement,
        modRequirement: { ...goal.modRequirement, required: required.filter(mod => mod !== "NF") },
      });
      assert.equal(row.status, status);
      assert.equal(row.reward_bp, 100);
      assert.equal(createBountySchema.safeParse({ rewardBp: 100, goal: row.goal }).success, true);
      await pool.query(migration);
      assert.deepEqual((await pool.query("SELECT * FROM bounties WHERE id=$1", [id])).rows[0], row);
    }
  }
});

test("migration leaves existing pass and full combo goals unchanged", async () => {
  for (const type of ["pass", "full_combo"]) {
    const id = randomUUID();
    const goal = { type, beatmapId: 123, minimumGrade: "S", modRequirement: {
      required: [], forbidden: [], allowOtherMods: false,
    } };
    await pool.query(
      "INSERT INTO bounties (id,status,reward_bp,creator_osu_user_id,goal) VALUES ($1,'open',100,42,$2)",
      [id, JSON.stringify(goal)],
    );
    const before = (await pool.query("SELECT * FROM bounties WHERE id=$1", [id])).rows[0];
    await pool.query(migration);
    assert.deepEqual((await pool.query("SELECT * FROM bounties WHERE id=$1", [id])).rows[0], before);
  }
});

test("migration requeues only converted open bounty attempts and preserves evidence and closed history", async () => {
  const userId = randomUUID();
  await pool.query("INSERT INTO users (id,osu_user_id,username) VALUES ($1,42,'fixture')", [userId]);
  const cases = [];
  for (const [type, status] of [
    ["minimum_grade", "open"], ["minimum_grade", "completed"],
    ["minimum_grade", "cancelled"], ["pass", "open"], ["full_combo", "open"],
  ]) {
    const bountyId = randomUUID(), huntId = randomUUID();
    const goal = { type, beatmapId: 123, minimumGradeRequirement: "A", modRequirement: {
      required: type === "minimum_grade" ? ["NF"] : [], forbidden: [], allowOtherMods: false,
    } };
    await pool.query("INSERT INTO bounties (id,status,reward_bp,creator_osu_user_id,goal) VALUES ($1,$2,100,7,$3)", [bountyId,status,JSON.stringify(goal)]);
    await pool.query("INSERT INTO bounty_hunts (id,bounty_id,user_id,status,started_at,ended_at) VALUES ($1,$2,$3,'stopped','2026-01-01','2026-01-03')", [huntId,bountyId,userId]);
    for (const [verificationStatus, mods] of [["valid", [{ acronym: "NF" }]], ["invalid", []], ["pending", []]] as const) {
      const attemptId = randomUUID();
      const result = verificationStatus === "pending" ? null : { modsAreCorrect: verificationStatus === "valid" };
      await pool.query(`INSERT INTO hunt_attempts
        (id,hunt_id,score_id,score_ended_at,discovered_at,score_evidence,verification_status,verification_result,verified_at,verification_attempts,next_verification_at,last_verification_error)
        VALUES ($1,$2,$3,'2026-01-02','2026-01-02',$4,$5,$6,$7,2,'2099-01-01','fixture error')`,
        [attemptId,huntId,cases.length+1,JSON.stringify({ mods }),verificationStatus,result === null ? null : JSON.stringify(result),result === null ? null : new Date("2026-01-02")]);
      const before = (await pool.query("SELECT * FROM hunt_attempts WHERE id=$1", [attemptId])).rows[0];
      cases.push({ before, requeued: type === "minimum_grade" && status === "open" });
    }
  }
  await pool.query(migration);
  for (const { before, requeued } of cases) {
    const after = (await pool.query("SELECT * FROM hunt_attempts WHERE id=$1", [before.id])).rows[0];
    if (!requeued) { assert.deepEqual(after,before); continue; }
    assert.deepEqual(after, { ...before,
      verification_status: "pending", verification_result: null, verified_at: null,
      verification_attempts: 0, next_verification_at: after.next_verification_at,
      last_verification_error: null,
    });
    assert.ok(after.next_verification_at instanceof Date);
    assert.ok(after.next_verification_at.getTime() <= Date.now());
  }
  const beforeRetry = (await pool.query("SELECT * FROM hunt_attempts ORDER BY id")).rows;
  await pool.query(migration);
  assert.deepEqual((await pool.query("SELECT * FROM hunt_attempts ORDER BY id")).rows, beforeRetry);
});
