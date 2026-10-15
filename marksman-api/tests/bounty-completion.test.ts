import assert from "node:assert/strict";
import { createTestDatabase } from "./fixtures/test-database";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { bountySchema, type Bounty, type UserIdentity } from "@marksman/contracts";
import { bounties, ledgerEntries, sessions, users } from "../src/db/schema";
import { BountyNotFoundError, BountyNotOpenError, PayoutRecipientNotFoundError } from "../src/services/errors";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_completion_tests&options=-c%20statement_timeout%3D10000",
  FRONTEND_URL: "http://localhost:3000/", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-client-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { app } = require("../src/app") as typeof import("../src/app");
const { sessionStore } = require("../src/db/session-store") as typeof import("../src/db/session-store");
const { attemptBountyCompletion, completeBounty } = require("../src/services/bounty-completion") as typeof import("../src/services/bounty-completion");
const { cancelBounty } = require("../src/services/bounties") as typeof import("../src/services/bounties");
const httpFetch = globalThis.fetch;
const secret = process.env.SESSION_SECRET!;
let server: Server | undefined;
let baseUrl: string;
const testDatabase = createTestDatabase(db, true);
let bounty: Bounty;
let beatmapId = 200000;
let scoreReply: (id: number) => Response | Promise<Response>;
let metadataReply: () => Response | Promise<Response>;
let upstreamCalls: string[];

before(async () => {
  await testDatabase.prepare();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    upstreamCalls.push(url);
    if (url === "https://osu.ppy.sh/oauth/token") return Response.json({ access_token: "fixture-token", expires_in: 3600, token_type: "Bearer" });
    if (url === `https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}`) return metadataReply();
    const match = /^https:\/\/osu\.ppy\.sh\/api\/v2\/scores\/(\d+)$/.exec(url);
    if (match) return scoreReply(Number(match[1]));
    throw new Error(`Unexpected fetch: ${url}; live requests are disabled`);
  });
});

beforeEach(async () => {
  await testDatabase.clear();
  // Distinct IDs prevent cached beatmaps from masking each case's upstream response.
  beatmapId++;
  upstreamCalls = [];
  const base = qualifyingBounty();
  bounty = { ...base, goal: { ...base.goal, beatmapId } };
  await db.insert(users).values([
    { osuUserId: bounty.creatorOsuUserId, username: "creator", bpBalance: 70 },
    { id: hunter.id, osuUserId: hunter.osuUserId, username: hunter.username, bpBalance: 5 },
    { osuUserId: 43, username: "other_hunter", bpBalance: 10 },
  ]);
  // Seed an already funded bounty: creator started with 100 BP and escrow is 30.
  // Seed using the pre-history columns, as an existing funded bounty would have them.
  // This also lets migration/schema regressions surface in the actual assertions.
  await db.execute(sql`INSERT INTO bounties (id, status, reward_bp, goal, creator_osu_user_id, created_at)
    VALUES (${bounty.id}, ${bounty.status}, ${bounty.rewardBp}, ${JSON.stringify(bounty.goal)}::jsonb,
      ${bounty.creatorOsuUserId}, ${bounty.createdAt}::timestamptz)`);
  const seededUsers = await db.select().from(users);
  const creator = seededUsers.find(user => user.osuUserId === bounty.creatorOsuUserId)!;
  await db.insert(ledgerEntries).values([
    ...seededUsers.map(user => ({
      userId: user.id,
      amount: user.osuUserId === bounty.creatorOsuUserId ? 100 : user.bpBalance,
      reason: "initial_grant" as const,
    })),
    { userId: creator.id, amount: -bounty.rewardBp, reason: "bounty_funding", bountyId: bounty.id },
  ]);
  metadataReply = () => Response.json(metadata);
  scoreReply = id => Response.json({ ...qualifyingScore(), id, beatmap_id: beatmapId });
});

after(async () => {
  try {
    if (server) await new Promise<void>((resolve, reject) => {
      server!.close(error => error ? reject(error) : resolve());
      server!.closeAllConnections();
    });
    sessionStore.close();
    await testDatabase.clearIfMigrated();
  } finally {
    mock.restoreAll();
    await db.$client.end();
  }
});

async function snapshot() {
  return {
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    users: await db.select().from(users).orderBy(users.osuUserId),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  };
}
async function assertState(status: Bounty["status"], creatorBalance = 70, hunterBalance = 5, otherBalance = 10) {
  const state = await snapshot();
  assert.equal(state.bounties.length, 1);
  assert.equal(state.bounties[0].id, bounty.id);
  assert.equal(state.bounties[0].status, status);
  assert.equal(state.bounties[0].creatorOsuUserId, bounty.creatorOsuUserId, "Completion must preserve the creator");
  if (status !== "completed") {
    assert.equal(state.bounties[0].completedByOsuUserId, null);
    assert.equal(state.bounties[0].completionScoreId, null);
    assert.equal(state.bounties[0].completedAt, null);
  }
  assert.deepEqual(state.users.map(u => [u.osuUserId, u.bpBalance]), [[7, creatorBalance], [42, hunterBalance], [43, otherBalance]]);
  const settlements = state.ledger.filter(entry => entry.reason === "bounty_reward" || entry.reason === "bounty_refund");
  if (status === "completed" || status === "cancelled") {
    const recipientOsuId = status === "completed" ? state.bounties[0].completedByOsuUserId : bounty.creatorOsuUserId;
    const recipient = state.users.find(user => user.osuUserId === recipientOsuId)!;
    assert.equal(settlements.length, 1, "Exactly one settlement ledger entry must exist");
    assert.deepEqual(settlements.map(({ userId, amount, reason, bountyId }) => ({ userId, amount, reason, bountyId })), [{
      userId: recipient.id, amount: bounty.rewardBp,
      reason: status === "completed" ? "bounty_reward" : "bounty_refund", bountyId: bounty.id,
    }]);
    assert.ok(settlements[0].createdAt instanceof Date);
  } else assert.equal(settlements.length, 0);
  for (const user of state.users) {
    assert.equal(state.ledger.filter(entry => entry.userId === user.id).reduce((sum, entry) => sum + entry.amount, 0), user.bpBalance,
      "Ledger totals must match each user's balance");
  }
}
// Seed an authentic signed session cookie directly; OAuth itself has its own suite.
async function cookieFor(osuUserId = hunter.osuUserId) {
  const [user] = await db.select().from(users).where(eq(users.osuUserId, osuUserId));
  assert.ok(user);
  const sid = randomUUID();
  const expire = new Date(Date.now() + 60_000);
  await db.insert(sessions).values({ sid, expire, sess: {
    cookie: { originalMaxAge: 60_000, expires: expire.toISOString(), httpOnly: true, path: "/", sameSite: "lax" },
    userId: user.id,
  } });
  const signature = createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
  return `marksman.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}
async function request(body: unknown = { scoreId: 987654 }, options: { cookie?: string; origin?: string | null; id?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.origin !== null) headers.Origin = options.origin ?? "http://localhost:3000";
  if (options.cookie) headers.Cookie = options.cookie;
  return httpFetch(`${baseUrl}/bounties/${options.id ?? bounty.id}/complete`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
}
async function assertHttpError(status: number, code?: string, options: Parameters<typeof request>[1] = {}) {
  const original = await snapshot();
  const response = await request(undefined, { cookie: await cookieFor(), ...options });
  assert.equal(response.status, status);
  const body = await response.json();
  if (code) assert.equal(body.code, code);
  assert.equal(typeof body.error, "string");
  assert.deepEqual(await snapshot(), original, "An unsuccessful claim must not change status or balances");
}

async function assertHistory(completed: Bounty, scoreId: number, winnerId = hunter.osuUserId, startedAt = Date.now() - 60_000) {
  assert.ok(completed.completedAt, "Completion must record a timestamp");
  const timestamp = Date.parse(completed.completedAt);
  assert.ok(timestamp >= startedAt && timestamp <= Date.now(), "Use completion time, not score or creation time");
  assert.deepEqual(completed, {
    ...bounty, status: "completed", completedByOsuUserId: winnerId,
    completionScoreId: scoreId, completedAt: completed.completedAt,
  });
  assert.ok(bountySchema.safeParse(completed).success);
  const [stored] = await db.select().from(bounties).where(eq(bounties.id, bounty.id));
  assert.equal(stored.creatorOsuUserId, bounty.creatorOsuUserId);
  assert.equal(stored.completedByOsuUserId, winnerId);
  assert.equal(stored.completionScoreId, scoreId);
  assert.equal(stored.completedAt?.toISOString(), completed.completedAt);
}

test("completion service returns persisted history and repeat claims cannot overwrite it", async () => {
  const startedAt = Date.now();
  const result = await attemptBountyCompletion(987654, bounty.id, hunter);
  assert.equal(result.completed, true);
  if (!result.completed) return;
  await assertHistory(result.bounty, 987654, hunter.osuUserId, startedAt);
  await assertState("completed", 70, 35);
  const original = await snapshot();
  await assert.rejects(() => attemptBountyCompletion(987655, bounty.id, hunter), BountyNotOpenError);
  assert.deepEqual(await snapshot(), original);
});
test("failed verification returns false with no mutation", async () => {
  scoreReply = () => Response.json({ ...qualifyingScore(), beatmap_id: beatmapId, passed: false });
  const original = await snapshot();
  assert.deepEqual(await attemptBountyCompletion(987654, bounty.id, hunter), { completed: false });
  assert.deepEqual(await snapshot(), original);
});
test("transaction looks up and pays the stored reward by bounty ID", async () => {
  await assertHistory(await completeBounty(bounty.id, 987654, hunter), 987654);
  await assertState("completed", 70, 35);
});
test("transaction rejects a missing payout recipient and rolls back completion", async () => {
  await assert.rejects(() => completeBounty(bounty.id, 987654, { ...hunter, osuUserId: 999 }), PayoutRecipientNotFoundError);
  await assertState("open");
});
test("service rejects malformed and missing bounty IDs before upstream calls", async () => {
  await assert.rejects(() => attemptBountyCompletion(987654, "invalid", hunter), /Invalid\/malformed bounty uuid/);
  await assert.rejects(() => attemptBountyCompletion(987654, randomUUID(), hunter), BountyNotFoundError);
  assert.deepEqual(upstreamCalls, []);
  await assertState("open");
});

test("HTTP success uses the session identity and returns completed status after payout", async () => {
  const cookie = await cookieFor();
  // Extra client fields cannot choose a recipient, reward, or trusted score evidence.
  const response = await request({ scoreId: 987654, userIdentity: { osuUserId: 43 }, rewardBp: 999, completedByOsuUserId: 43, completionScoreId: 1, completedAt: "2000-01-01T00:00:00.000Z", score: { passed: false } }, { cookie });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.message, "Bounty completed");
  await assertHistory(body.bounty, 987654);
  await assertState("completed", 70, 35);
  const me = await httpFetch(`${baseUrl}/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).stats.bpBalance, 35);
  assert.equal((await request(undefined, { cookie })).status, 409);
  await assertState("completed", 70, 35);
});
test("HTTP accepts minimum-grade completion without requiring FC", async () => {
  const goal: Bounty["goal"] = { ...bounty.goal, type: "minimum_grade", minimumGradeRequirement: "A" };
  await db.update(bounties).set({ goal });
  scoreReply = () => Response.json({ ...qualifyingScore(), beatmap_id: beatmapId, legacy_score_id: 123, max_combo: 1, statistics: { miss: 5 }, rank: "A" });
  const response = await request(undefined, { cookie: await cookieFor() });
  assert.equal(response.status, 200);
  await assertState("completed", 70, 35);
});
for (const origin of [null, "null", "http://untrusted.example", "http://localhost:3000.evil.example"]) {
  test(`completion rejects untrusted Origin ${origin}`, async () => {
    await assertHttpError(403, undefined, { origin });
    assert.deepEqual(upstreamCalls, []);
  });
}
for (const scenario of ["missing", "tampered", "expired", "deleted-user"] as const) {
  test(`completion rejects ${scenario} session`, async () => {
    let cookie: string | undefined;
    if (scenario !== "missing") cookie = await cookieFor();
    if (scenario === "tampered") cookie += "tampered";
    if (scenario === "expired") await db.update(sessions).set({ expire: new Date(Date.now() - 60_000) });
    if (scenario === "deleted-user") {
      await db.delete(ledgerEntries).where(eq(ledgerEntries.userId, hunter.id));
      await db.delete(users).where(eq(users.osuUserId, hunter.osuUserId));
    }
    const original = await snapshot();
    assert.equal((await request(undefined, { cookie })).status, 401);
    assert.deepEqual(await snapshot(), original);
    assert.deepEqual(upstreamCalls, []);
  });
}
for (const body of [{}, { scoreId: 0 }, { scoreId: -1 }, { scoreId: 1.5 }, { scoreId: "987654" }, { scoreId: null }, []]) {
  test(`completion rejects invalid body ${JSON.stringify(body)}`, async () => {
    const response = await request(body, { cookie: await cookieFor() });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      code: "MALFORMED_SCORE_ID",
      error: "Malformed score ID",
    });
    assert.deepEqual(upstreamCalls, []);
    await assertState("open");
  });
}
test("completion rejects malformed route ID", async () => {
  await assertHttpError(400, "MALFORMED_BOUNTY_ID", { id: "invalid" });
  assert.deepEqual(upstreamCalls, []);
});
test("completion maps missing bounty to 404", async () => {
  await assertHttpError(404, "BOUNTY_NOT_FOUND", { id: randomUUID() });
  assert.deepEqual(upstreamCalls, []);
});
for (const status of ["draft", "cancelled", "completed"] as const) {
  test(`completion maps initially ${status} bounty to 409 without fetching`, async () => {
    await db.update(bounties).set({ status });
    await assertHttpError(409, "BOUNTY_NOT_OPEN");
    assert.deepEqual(upstreamCalls, []);
  });
}
for (const scenario of ["wrong-claimant", "creator", "failed-goal"] as const) {
  test(`completion maps ${scenario} verification to 422 without payout`, async () => {
    const userId = scenario === "creator" ? bounty.creatorOsuUserId : hunter.osuUserId;
    scoreReply = () => Response.json({ ...qualifyingScore(), beatmap_id: beatmapId,
      user_id: scenario === "wrong-claimant" ? 43 : userId,
      statistics: { miss: scenario === "failed-goal" ? 1 : 0 },
    });
    await assertHttpError(422, undefined, { cookie: await cookieFor(userId) });
  });
}
for (const [status, expected, code] of [[404, 404, "SCORE_NOT_FOUND"], [429, 502, "OSU_API_ERROR"], [500, 502, "OSU_API_ERROR"]] as const) {
  test(`completion maps score HTTP ${status}`, async () => {
    scoreReply = () => new Response("private upstream details", { status });
    await assertHttpError(expected, code);
  });
}
for (const kind of ["schema", "json", "network", "timeout"] as const) {
  test(`completion maps score ${kind} failure to 502`, async () => {
    scoreReply = () => {
      if (kind === "schema") return Response.json({ invalid: true });
      if (kind === "json") return new Response("not JSON");
      if (kind === "timeout") throw new DOMException("fixture timeout", "TimeoutError");
      throw new TypeError("fixture network failure");
    };
    await assertHttpError(502, "OSU_API_ERROR");
  });
}
for (const kind of ["http", "schema"] as const) {
  test(`completion maps unavailable metadata (${kind}) to 502 before score fetching`, async t => {
    t.mock.method(console, "error", () => {});
    metadataReply = () => kind === "http" ? new Response("unavailable", { status: 503 }) : Response.json({ ...metadata, max_combo: 0 });
    await assertHttpError(502, "UNAVAILABLE_METADATA");
    assert.equal(upstreamCalls.some(url => url.includes("/scores/")), false);
  });
}
test("claimant disappearing after authentication maps to 500 and rolls back", async () => {
  const cookie = await cookieFor();
  scoreReply = async () => {
    await db.delete(ledgerEntries).where(eq(ledgerEntries.userId, hunter.id));
    await db.delete(users).where(eq(users.osuUserId, hunter.osuUserId));
    return Response.json({ ...qualifyingScore(), beatmap_id: beatmapId });
  };
  const response = await request(undefined, { cookie });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, "UNAVAILABLE_CLAIMANT");
  const state = await snapshot();
  assert.equal(state.bounties[0].status, "open");
  assert.equal(state.bounties[0].completedByOsuUserId, null);
  assert.equal(state.bounties[0].completionScoreId, null);
  assert.equal(state.bounties[0].completedAt, null);
  assert.deepEqual(state.users.map(u => [u.osuUserId, u.bpBalance]), [[7, 70], [43, 10]]);
});

test("database payout failure rolls back the prior status update and reaches central 500 handler", async t => {
  const log = t.mock.method(console, "error", () => {});
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_payout() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM bounties WHERE status = 'completed' AND completed_at IS NOT NULL AND completion_score_id IS NOT NULL AND completed_by_osu_user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Test expected completion before payout';
      END IF;
      RAISE EXCEPTION 'Forced payout failure';
    END; $$
  `);
  try {
    await db.execute(sql`CREATE TRIGGER test_reject_payout BEFORE UPDATE OF bp_balance ON users FOR EACH ROW EXECUTE FUNCTION test_reject_payout()`);
    // Inspect the cause chain so a failure for the wrong reason cannot pass.
    await assert.rejects(() => attemptBountyCompletion(987654, bounty.id, hunter), (error: unknown) => {
      let cause = error;
      while (cause instanceof Error) {
        if (cause.message === "Forced payout failure") return true;
        cause = cause.cause;
      }
      return false;
    });
    await assertState("open");
    const response = await request(undefined, { cookie: await cookieFor() });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      code: "UNEXPECTED_ERROR",
      error: "Internal server error",
    });
    assert.ok(log.mock.callCount() > 0);
    await assertState("open");
  } finally {
    await db.execute(sql`DROP TRIGGER IF EXISTS test_reject_payout ON users`);
    await db.execute(sql`DROP FUNCTION test_reject_payout()`);
  }
});

test("reward ledger uses the credited database user even if the supplied internal ID differs", async () => {
  await completeBounty(bounty.id, 987654, { ...hunter, id: randomUUID() });
  await assertState("completed", 70, 35);
});

test("reward ledger insert failure rolls back completion and payout and permits retry", async t => {
  t.mock.method(console, "error", () => {});
  const original = await snapshot();
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_reward_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.reason = 'bounty_reward' THEN
        IF NOT EXISTS (SELECT 1 FROM bounties WHERE id = NEW.bounty_id AND status = 'completed'
          AND completed_at IS NOT NULL AND completion_score_id IS NOT NULL)
          OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND bp_balance = 35) THEN
          RAISE EXCEPTION 'Test expected completion and credit before ledger insertion';
        END IF;
        RAISE EXCEPTION 'Forced reward ledger failure';
      END IF;
      RETURN NEW;
    END; $$
  `);
  try {
    await db.execute(sql`CREATE TRIGGER test_reject_reward_ledger BEFORE INSERT ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION test_reject_reward_ledger()`);
    await assert.rejects(() => attemptBountyCompletion(987654, bounty.id, hunter), (error: unknown) => {
      let cause = error;
      while (cause instanceof Error) {
        if (cause.message === "Forced reward ledger failure") return true;
        cause = cause.cause;
      }
      return false;
    });
    assert.deepEqual(await snapshot(), original);
    const response = await request(undefined, { cookie: await cookieFor() });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { code: "UNEXPECTED_ERROR", error: "Internal server error" });
    assert.deepEqual(await snapshot(), original);
  } finally {
    await db.execute(sql`DROP TRIGGER IF EXISTS test_reject_reward_ledger ON ledger_entries`);
    await db.execute(sql`DROP FUNCTION test_reject_reward_ledger()`);
  }
  assert.equal((await attemptBountyCompletion(987654, bounty.id, hunter)).completed, true);
  await assertState("completed", 70, 35);
});

async function contend<T>(start: () => Promise<T>[]) {
  const blocker = await db.$client.connect();
  let pending: Promise<PromiseSettledResult<T>[]> | undefined;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM bounties WHERE id = $1 FOR UPDATE", [bounty.id]);
    pending = Promise.allSettled(start());
    const deadline = Date.now() + 5000;
    while (true) {
      const { rows } = await db.$client.query(`SELECT count(*)::integer AS waiting FROM pg_stat_activity
        WHERE application_name = 'marksman_completion_tests' AND datname = current_database() AND wait_event_type = 'Lock'`);
      if (rows[0].waiting >= 2) break;
      assert.ok(Date.now() < deadline, "Both requests must reach the locked bounty before release");
      await delay(20);
    }
    await blocker.query("COMMIT");
    return await pending;
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await pending;
  }
}
test("concurrent HTTP claims award exactly one hunter and return 200/409", { timeout: 15000 }, async () => {
  const cookies = [await cookieFor(), await cookieFor(43)];
  scoreReply = id => Response.json({ ...qualifyingScore(), id, beatmap_id: beatmapId, user_id: id === 1 ? 42 : 43 });
  const results = await contend(() => cookies.map((cookie, i) => request({ scoreId: i + 1 }, { cookie })));
  const responses = results.map(result => {
    assert.equal(result.status, "fulfilled");
    return (result as PromiseFulfilledResult<Response>).value;
  });
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const winner = responses.findIndex(r => r.status === 200);
  const winningBody = await responses[winner].json();
  await assertHistory(winningBody.bounty, winner + 1, winner === 0 ? 42 : 43);
  const preserved = await snapshot();
  assert.equal((await request({ scoreId: 100 }, { cookie: cookies[1 - winner] })).status, 409);
  assert.deepEqual(await snapshot(), preserved);
  const loser = await responses[1 - winner].json();
  assert.equal(loser.code, "BOUNTY_NOT_OPEN");
  await assertState("completed", 70, winner === 0 ? 35 : 5, winner === 1 ? 40 : 10);
});
test("completion racing cancellation either pays the hunter or refunds the creator once", { timeout: 15000 }, async () => {
  const results = await contend<unknown>(() => [
    attemptBountyCompletion(987654, bounty.id, hunter),
    cancelBounty(bounty.id, bounty.creatorOsuUserId),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const failure = results.find(r => r.status === "rejected");
  assert.ok(failure && failure.status === "rejected");
  assert.ok(failure.reason instanceof BountyNotOpenError);
  if (results[0].status === "fulfilled") {
    const result = results[0].value as { completed: true; bounty: Bounty };
    await assertHistory(result.bounty, 987654);
    await assertState("completed", 70, 35);
  }
  else await assertState("cancelled", 100, 5);
});

test("stable FC at the configured threshold completes through HTTP", async () => {
  scoreReply = () => Response.json({ ...qualifyingScore(), beatmap_id: beatmapId, legacy_score_id: 123, max_combo: 990 });
  const response = await request(undefined, { cookie: await cookieFor() });
  assert.equal(response.status, 200);
  await assertState("completed", 70, 35);
});
test("stable FC below threshold is rejected without payout", async () => {
  scoreReply = () => Response.json({ ...qualifyingScore(), beatmap_id: beatmapId, legacy_score_id: 123, max_combo: 989 });
  await assertHttpError(422);
});
test("cancellation during score fetching wins and completion returns 409 without payout", async () => {
  scoreReply = async () => {
    // Awaiting cancellation here also proves upstream I/O holds no bounty row lock.
    await cancelBounty(bounty.id, bounty.creatorOsuUserId);
    return Response.json({ ...qualifyingScore(), beatmap_id: beatmapId });
  };
  const response = await request(undefined, { cookie: await cookieFor() });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "BOUNTY_NOT_OPEN");
  await assertState("cancelled", 100, 5);
});
test("successful completion prevents a later creator refund", async () => {
  await attemptBountyCompletion(987654, bounty.id, hunter);
  await assert.rejects(() => cancelBounty(bounty.id, bounty.creatorOsuUserId), BountyNotOpenError);
  await assertState("completed", 70, 35);
});
test("concurrent duplicate submissions from one claimant pay once", { timeout: 15000 }, async () => {
  const results = await contend(() => [
    attemptBountyCompletion(987654, bounty.id, hunter),
    attemptBountyCompletion(987654, bounty.id, hunter),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const failure = results.find(r => r.status === "rejected");
  assert.ok(failure && failure.status === "rejected");
  assert.ok(failure.reason instanceof BountyNotOpenError);
  await assertState("completed", 70, 35);
});


test("open bounty exposes null completion fields through detail and listing", async () => {
  for (const path of [`/bounties/${bounty.id}`, "/bounties"]) {
    const response = await httpFetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    const item = Array.isArray(body) ? body.find((item: Bounty) => item.id === bounty.id) : body;
    assert.ok(item);
    assert.equal(item.creatorOsuUserId, bounty.creatorOsuUserId);
    assert.equal(item.completedByOsuUserId, null);
    assert.equal(item.completionScoreId, null);
    assert.equal(item.completedAt, null);
    bountySchema.parse(item);
  }
});

test("verified score IDs beyond int32 survive completion and public readback", async () => {
  const scoreId = 5_000_000_123;
  // Record the verified response ID, not another ID or client-supplied history.
  scoreReply = () => Response.json({ ...qualifyingScore(), id: scoreId, beatmap_id: beatmapId });
  const result = await attemptBountyCompletion(987654, bounty.id, hunter);
  assert.equal(result.completed, true);
  if (!result.completed) return;
  await assertHistory(result.bounty, scoreId);
  for (const path of [`/bounties/${bounty.id}`, "/bounties"]) {
    const response = await httpFetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    const item = Array.isArray(body) ? body.find((item: Bounty) => item.id === bounty.id) : body;
    assert.deepEqual(bountySchema.parse(item), bountySchema.parse(result.bounty));
  }
});


test("migrations keep the creator required and give history separate nullable columns", async () => {
  const { rows } = await db.$client.query(`SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bounties'`);
  const columns = new Map(rows.map(row => [row.column_name, row]));
  assert.equal(columns.get("creator_osu_user_id")?.is_nullable, "NO");
  for (const [name, type] of [
    ["completed_by_osu_user_id", "integer"],
    ["completion_score_id", "bigint"],
    ["completed_at", "timestamp with time zone"],
  ]) {
    assert.ok(columns.has(name), `Missing column ${name}`);
    assert.equal(columns.get(name).data_type, type);
    assert.equal(columns.get(name).is_nullable, "YES");
    assert.equal(columns.get(name).column_default, null);
  }
});
