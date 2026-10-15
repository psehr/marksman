import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "drizzle-orm";
import type { UserIdentity } from "@marksman/contracts";
import { dailyClaims, ledgerEntries, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";

Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_daily_tests&options=-c%20statement_timeout%3D10000",
  FRONTEND_URL: "http://localhost:3000/", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-client-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { app } = require("../src/app") as typeof import("../src/app");
const { sessionStore } = require("../src/db/session-store") as typeof import("../src/db/session-store");
const { attemptDailyClaim } = require("../src/services/economy") as typeof import("../src/services/economy");
const testDatabase = createTestDatabase(db, true);
let server: Server;
let baseUrl: string;
let player: UserIdentity;
let other: UserIdentity;

before(async () => {
  await testDatabase.prepare();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await testDatabase.clear();
  const rows = await db.insert(users).values([
    { osuUserId: 42, username: "player", bpBalance: 330 },
    { osuUserId: 43, username: "other", bpBalance: 330 },
  ]).returning();
  [player, other] = rows.map(({ id, osuUserId, username }) => ({ id, osuUserId, username }));
  await db.insert(ledgerEntries).values(rows.map(user => ({ userId: user.id, amount: 330, reason: "initial_grant" as const })));
});
after(async () => {
  try {
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    sessionStore.close();
    await testDatabase.clearIfMigrated();
  } finally { await db.$client.end(); }
});
async function snapshot() {
  return {
    users: await db.select().from(users).orderBy(users.osuUserId),
    claims: await db.select().from(dailyClaims).orderBy(dailyClaims.userId, dailyClaims.claimDate),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  };
}
async function assertAwards(expected: { userId: string; claimDate: string }[]) {
  const state = await snapshot();
  const sort = (rows: typeof expected) => [...rows].sort((a, b) => a.userId.localeCompare(b.userId) || a.claimDate.localeCompare(b.claimDate));
  assert.deepEqual(sort(state.claims), sort(expected));
  const awards = state.ledger.filter(entry => entry.reason === "daily_claim");
  assert.equal(state.ledger.length, 2 + expected.length);
  assert.equal(awards.length, expected.length);
  for (const user of state.users) {
    const count = expected.filter(claim => claim.userId === user.id).length;
    assert.equal(user.bpBalance, 330 + 25 * count);
    assert.deepEqual(awards.filter(entry => entry.userId === user.id).map(({ amount, bountyId }) => ({ amount, bountyId })),
      Array.from({ length: count }, () => ({ amount: 25, bountyId: null })));
    assert.equal(state.ledger.filter(entry => entry.userId === user.id).reduce((sum, entry) => sum + entry.amount, 0), user.bpBalance);
  }
}
async function cookieFor(user = player) {
  const sid = randomUUID();
  const expire = new Date(Date.now() + 60_000);
  await db.insert(sessions).values({ sid, expire, sess: {
    cookie: { originalMaxAge: 60_000, expires: expire.toISOString(), httpOnly: true, path: "/", sameSite: "lax" }, userId: user.id,
  } });
  const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(sid).digest("base64").replace(/=+$/, "");
  return `marksman.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}
async function request(cookie?: string, origin: string | null = "http://localhost:3000", body?: unknown) {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (origin !== null) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${baseUrl}/economy/daily-claim`, { method: "POST", headers,
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
}

test("first claim awards 25 BP; same-day repeat changes nothing", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-05T12:00:00Z") });
  assert.equal(await attemptDailyClaim(player), true);
  await assertAwards([{ userId: player.id, claimDate: "2026-10-05" }]);
  const original = await snapshot();
  assert.equal(await attemptDailyClaim(player), false);
  assert.deepEqual(await snapshot(), original);
});
test("claims reset at UTC midnight, not local midnight or after 24 hours", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-06T01:59:59+02:00") });
  assert.equal(await attemptDailyClaim(player), true);
  t.mock.timers.setTime(new Date("2026-10-06T02:00:00+02:00").getTime());
  assert.equal(await attemptDailyClaim(player), true);
  assert.equal(await attemptDailyClaim(player), false);
  await assertAwards([{ userId: player.id, claimDate: "2026-10-05" }, { userId: player.id, claimDate: "2026-10-06" }]);
});
test("different users can claim independently on the same day", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-05T12:00:00Z") });
  assert.deepEqual(await Promise.all([attemptDailyClaim(player), attemptDailyClaim(other)]), [true, true]);
  await assertAwards([player, other].map(user => ({ userId: user.id, claimDate: "2026-10-05" })));
});
test("HTTP uses session identity and server reward/date; repeat returns 409", async () => {
  const cookie = await cookieFor();
  const beforeDate = new Date().toISOString().slice(0, 10);
  const response = await request(cookie, undefined, { userId: other.id, osuUserId: other.osuUserId, amount: 999, claimDate: "2000-01-01" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: "Daily reward claimed." });
  const date = (await snapshot()).claims[0].claimDate;
  assert.ok([beforeDate, new Date().toISOString().slice(0, 10)].includes(date));
  await assertAwards([{ userId: player.id, claimDate: date }]);
  const original = await snapshot();
  const repeat = await request(cookie);
  assert.equal(repeat.status, 409);
  assert.deepEqual(await repeat.json(), { code: "DAILY_ALREADY_CLAIMED", error: "Daily reward already claimed today." });
  assert.deepEqual(await snapshot(), original);
});
test("signed-out claim returns 401 without mutation", async () => {
  const original = await snapshot();
  assert.equal((await request()).status, 401);
  assert.deepEqual(await snapshot(), original);
});
for (const origin of [null, "null", "http://untrusted.example", "http://localhost:3000.evil.example"]) {
  test(`claim rejects untrusted Origin ${origin}`, async () => {
    const original = await snapshot();
    assert.equal((await request(await cookieFor(), origin)).status, 403);
    assert.deepEqual(await snapshot(), original);
  });
}
test("missing credit recipient rolls back claim and ledger", async () => {
  const original = await snapshot();
  await assert.rejects(() => attemptDailyClaim({ ...player, osuUserId: 99999 }), /Could not credit user/);
  assert.deepEqual(await snapshot(), original);
});
for (const stage of ["ledger", "credit"] as const) {
  test(`${stage} failure rolls back all writes, returns HTTP 500, and permits retry`, async t => {
    t.mock.method(console, "error", () => {});
    const original = await snapshot();
    await db.execute(sql.raw(`CREATE OR REPLACE FUNCTION test_reject_daily() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM daily_claims) THEN
          RAISE EXCEPTION 'Expected claim before failure';
        END IF;
        ${stage === "credit" ? "IF NOT EXISTS (SELECT 1 FROM ledger_entries WHERE reason = 'daily_claim') THEN RAISE EXCEPTION 'Expected ledger before credit'; END IF;" : ""}
        RAISE EXCEPTION 'Forced daily ${stage} failure';
      END; $$`));
    const table = stage === "ledger" ? "ledger_entries" : "users";
    try {
      await db.execute(sql.raw(`CREATE TRIGGER test_reject_daily BEFORE ${stage === "ledger" ? "INSERT" : "UPDATE OF bp_balance"} ON ${table} FOR EACH ROW EXECUTE FUNCTION test_reject_daily()`));
      await assert.rejects(() => attemptDailyClaim(player), (error: unknown) => {
        let cause = error;
        while (cause instanceof Error) {
          if (cause.message === `Forced daily ${stage} failure`) return true;
          cause = cause.cause;
        }
        return false;
      });
      assert.deepEqual(await snapshot(), original);
      const response = await request(await cookieFor());
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { code: "UNEXPECTED_ERROR", error: "Internal server error" });
      assert.deepEqual(await snapshot(), original);
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS test_reject_daily ON ${table}`));
      await db.execute(sql`DROP FUNCTION test_reject_daily()`);
    }
    assert.equal(await attemptDailyClaim(player), true);
    const date = (await snapshot()).claims[0].claimDate;
    await assertAwards([{ userId: player.id, claimDate: date }]);
  });
}
test("concurrent HTTP claims award once and return 200/409", { timeout: 15000 }, async () => {
  const cookie = await cookieFor();
  const blocker = await db.$client.connect();
  let pending: Promise<PromiseSettledResult<Response>[]> | undefined;
  try {
    await blocker.query("BEGIN");
    await blocker.query("LOCK TABLE daily_claims IN SHARE MODE");
    pending = Promise.allSettled([request(cookie), request(cookie)]);
    const deadline = Date.now() + 4000;
    while (true) {
      const { rows } = await db.$client.query(`SELECT count(*)::integer AS waiting FROM pg_stat_activity
        WHERE application_name = 'marksman_daily_tests' AND datname = current_database() AND wait_event_type = 'Lock'`);
      if (rows[0].waiting >= 2) break;
      assert.ok(Date.now() < deadline, "Both requests must reach the claim lock before release");
      await delay(20);
    }
    await blocker.query("COMMIT");
    const responses = (await pending).map(result => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const date = (await snapshot()).claims[0].claimDate;
    await assertAwards([{ userId: player.id, claimDate: date }]);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await pending;
  }
});
