import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, mock, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { MAX_BOUNTY_REWARD_BP } from "@marksman/contracts";
import { bounties, bountyContributions, ledgerEntries, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import {
  BountyNotFoundError, BountyNotOpenError, BountyRewardLimitError,
  ContributionIdempotencyConflictError, InsufficientBpError, UserNotFoundError,
} from "../src/services/errors";

process.env.DATABASE_URL = "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_contribution_tests&options=-c%20statement_timeout%3D10000";
Object.assign(process.env, {
  PORT: "3001", FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-secret", OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { contributeToBounty } = require("../src/services/bounty-contributions") as typeof import("../src/services/bounty-contributions");
const { cancelBounty } = require("../src/services/bounties") as typeof import("../src/services/bounties");
const { completeBounty } = require("../src/services/bounty-completion") as typeof import("../src/services/bounty-completion");
const testDatabase = createTestDatabase(db);
let nextOsuId = 100;
before(async () => {
  mock.method(globalThis, "fetch", async () => { throw new Error("Live upstream requests disabled"); });
  await testDatabase.prepare();
});
beforeEach(async () => { await testDatabase.clear(); });
after(async () => {
  try { await testDatabase.clearIfMigrated(); }
  finally { mock.restoreAll(); await db.$client.end(); }
});
async function seedUser(balance = 3_000_000) {
  const [user] = await db.insert(users).values({ username: "fixture", osuUserId: nextOsuId++, bpBalance: balance }).returning();
  if (balance > 0) await db.insert(ledgerEntries).values({ userId: user.id, amount: balance, reason: "initial_grant" });
  return user;
}
async function seedBounty(rewardBp = 25) {
  const creator = await seedUser();
  const feeBp = Math.ceil(rewardBp / 10);
  const [bounty] = await db.insert(bounties).values({
    creatorOsuUserId: creator.osuUserId, rewardBp, status: "open",
    goal: { type: "pass", beatmapId: 123, modRequirement: { rule: "any" }, beatmapChecksum: null },
  }).returning();
  await db.update(users).set({ bpBalance: creator.bpBalance - rewardBp - feeBp }).where(eq(users.id, creator.id));
  await db.insert(bountyContributions).values({ bountyId: bounty.id, userId: creator.id, amountBp: rewardBp, feeBp });
  await db.insert(ledgerEntries).values([
    { bountyId: bounty.id, userId: creator.id, amount: -rewardBp, reason: "bounty_funding" },
    { bountyId: bounty.id, userId: creator.id, amount: -feeBp, reason: "bounty_fee" },
  ]);
  return { bounty, creator };
}
const request = (amountBp = 10, idempotencyKey: string = randomUUID()) => ({ amountBp, idempotencyKey });
async function snapshot() {
  return {
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    contributions: await db.select().from(bountyContributions).orderBy(bountyContributions.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  };
}
async function assertAccounting() {
  const state = await snapshot();
  for (const user of state.users) {
    assert.equal(user.bpBalance, state.ledger.filter(row => row.userId === user.id).reduce((sum, row) => sum + row.amount, 0));
  }
  for (const bounty of state.bounties) {
    assert.equal(bounty.rewardBp, state.contributions.filter(row => row.bountyId === bounty.id).reduce((sum, row) => sum + row.amountBp, 0));
  }
}

for (const [amountBp, feeBp] of [[1, 1], [11, 2], [25, 3]] as const) {
  test(`contributing ${amountBp} records principal, fee ${feeBp}, balance and aggregate`, async () => {
    const { bounty } = await seedBounty();
    const user = await seedUser(amountBp + feeBp);
    const input = request(amountBp);
    const result = await contributeToBounty(bounty.id, user.id, input);
    assert.equal(result.userId, user.id);
    assert.equal(result.bountyId, bounty.id);
    assert.equal(result.amountBp, amountBp);
    assert.equal(result.feeBp, feeBp);
    assert.ok(Number.isFinite(Date.parse(result.createdAt)));
    const state = await snapshot();
    assert.equal(state.users.find(row => row.id === user.id)!.bpBalance, 0);
    assert.equal(state.contributions.find(row => row.id === result.id)!.idempotencyKey, input.idempotencyKey);
    assert.deepEqual(state.ledger.filter(row => row.userId === user.id && row.bountyId === bounty.id)
      .map(row => [row.reason, row.amount]).sort(), [["bounty_fee", -feeBp], ["bounty_funding", -amountBp]]);
    assert.equal(state.bounties[0].rewardBp, 25 + amountBp);
    assert.deepEqual({ ...state.bounties[0], rewardBp: 25 }, bounty, "Only aggregate reward changes");
    await assertAccounting();
  });
}

test("creator top-ups, repeated funding with new keys, and per-user key scoping", async () => {
  const { bounty, creator } = await seedBounty();
  const other = await seedUser();
  const input = request();
  const first = await contributeToBounty(bounty.id, creator.id, input);
  const second = await contributeToBounty(bounty.id, creator.id, request());
  const third = await contributeToBounty(bounty.id, other.id, input);
  assert.equal(new Set([first.id, second.id, third.id]).size, 3);
  await assertAccounting();
});

test("identical retry returns the original record without another charge, with UUID case normalization", async () => {
  const { bounty } = await seedBounty();
  const user = await seedUser(11);
  const input = request();
  const first = await contributeToBounty(bounty.id, user.id, input);
  const original = await snapshot();
  const replay = await contributeToBounty(bounty.id.toUpperCase(), user.id.toUpperCase(), { ...input, idempotencyKey: input.idempotencyKey.toUpperCase() });
  assert.deepEqual(replay, first);
  assert.deepEqual(await snapshot(), original);
});

for (const change of ["amount", "bounty"] as const) {
  test(`reusing a key with changed ${change} conflicts without mutations`, async () => {
    const { bounty } = await seedBounty();
    const otherBounty = await seedBounty();
    const user = await seedUser();
    const input = request();
    await contributeToBounty(bounty.id, user.id, input);
    const original = await snapshot();
    await assert.rejects(() => contributeToBounty(change === "bounty" ? otherBounty.bounty.id : bounty.id,
      user.id, change === "amount" ? { ...input, amountBp: 11 } : input), ContributionIdempotencyConflictError);
    assert.deepEqual(await snapshot(), original);
  });
}

for (const status of ["draft", "completed", "cancelled"] as const) {
  test(`new contributions to ${status} bounties leave all state unchanged`, async () => {
    const { bounty } = await seedBounty();
    const user = await seedUser();
    await db.update(bounties).set({ status }).where(eq(bounties.id, bounty.id));
    const original = await snapshot();
    await assert.rejects(() => contributeToBounty(bounty.id, user.id, request()), BountyNotOpenError);
    assert.deepEqual(await snapshot(), original);
  });
}
for (const closure of ["cancel", "complete"] as const) {
  test(`successful requests replay after ${closure}, including zero available balance`, async () => {
    const { bounty, creator } = await seedBounty();
    const user = await seedUser(11);
    const input = request();
    const first = await contributeToBounty(bounty.id, user.id, input);
    if (closure === "cancel") await cancelBounty(bounty.id, creator.osuUserId);
    else {
      const winner = await seedUser(0);
      await completeBounty(bounty.id, 123, { id: winner.id, osuUserId: winner.osuUserId, username: winner.username, coverUrl: null, countryCode: null, countryName: null });
    }
    const original = await snapshot();
    assert.deepEqual(await contributeToBounty(bounty.id, user.id, input), first);
    assert.deepEqual(await snapshot(), original);
    await assertAccounting();
  });
}

test("missing bounty and missing contributor use domain errors without mutations", async () => {
  const { bounty } = await seedBounty();
  const user = await seedUser();
  const original = await snapshot();
  await assert.rejects(() => contributeToBounty(randomUUID(), user.id, request()), BountyNotFoundError);
  await assert.rejects(() => contributeToBounty(bounty.id, randomUUID(), request()), UserNotFoundError);
  assert.deepEqual(await snapshot(), original);
});

test("insufficient funds include fees; failed keys can be retried", async () => {
  const { bounty } = await seedBounty();
  const user = await seedUser(10);
  const input = request();
  const original = await snapshot();
  await assert.rejects(() => contributeToBounty(bounty.id, user.id, input), InsufficientBpError);
  assert.deepEqual(await snapshot(), original);
  await db.update(users).set({ bpBalance: 11 }).where(eq(users.id, user.id));
  await db.insert(ledgerEntries).values({ userId: user.id, amount: 1, reason: "daily_claim" });
  await contributeToBounty(bounty.id, user.id, input);
  await assertAccounting();
});

test("cap is inclusive, rejects overflow, and permits replay when full", async () => {
  const { bounty } = await seedBounty(MAX_BOUNTY_REWARD_BP - 1);
  const user = await seedUser();
  const input = request(1);
  const first = await contributeToBounty(bounty.id, user.id, input);
  const original = await snapshot();
  assert.equal(original.bounties[0].rewardBp, MAX_BOUNTY_REWARD_BP);
  assert.deepEqual(await contributeToBounty(bounty.id, user.id, input), first);
  await assert.rejects(() => contributeToBounty(bounty.id, user.id, request(1)), BountyRewardLimitError);
  assert.deepEqual(await snapshot(), original);
});

test("malformed requests are rejected before any database changes", async () => {
  const { bounty } = await seedBounty();
  const user = await seedUser();
  const original = await snapshot();
  for (const amountBp of [0, -1, 0.5, MAX_BOUNTY_REWARD_BP + 1]) {
    await assert.rejects(() => contributeToBounty(bounty.id, user.id, request(amountBp)));
  }
  await assert.rejects(() => contributeToBounty(bounty.id, user.id, request(10, "bad-key")));
  await assert.rejects(() => contributeToBounty("bad-bounty", user.id, request()));
  assert.deepEqual(await snapshot(), original);
});

// Hold a real bounty row until both requests have reached database locks.
async function raceOnBounty<T>(bountyId: string, actions: (() => Promise<T>)[], table: "bounties" | "users" = "bounties") {
  const blocker = await db.$client.connect();
  let pending: Promise<PromiseSettledResult<T>[]> | undefined;
  try {
    await blocker.query("BEGIN");
    await blocker.query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, [bountyId]);
    pending = Promise.allSettled(actions.map(action => action()));
    const deadline = Date.now() + 5000;
    while (true) {
      const { rows } = await db.$client.query(`SELECT count(*)::integer AS waiting FROM pg_stat_activity
        WHERE application_name = 'marksman_contribution_tests' AND datname = current_database() AND wait_event_type = 'Lock'`);
      if (rows[0].waiting >= actions.length) break;
      assert.ok(Date.now() < deadline, "Both requests must reach database locks");
      await delay(20);
    }
    await blocker.query("COMMIT");
    return await pending;
  } finally {
    await blocker.query("ROLLBACK"); blocker.release(); await pending;
  }
}
test("concurrent identical requests charge once and return the same record", async () => {
  const { bounty } = await seedBounty();
  const user = await seedUser(11);
  const input = request();
  const results = await raceOnBounty(bounty.id, [
    () => contributeToBounty(bounty.id, user.id, input),
    () => contributeToBounty(bounty.id, user.id, input),
  ]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 2);
  if (results[0].status === "fulfilled" && results[1].status === "fulfilled") assert.deepEqual(results[0].value, results[1].value);
  assert.equal((await snapshot()).contributions.length, 2);
  await assertAccounting();
});

test("concurrent changed payloads sharing a key charge once and conflict once", async () => {
  const { bounty } = await seedBounty();
  const user = await seedUser();
  const key = randomUUID();
  const results = await raceOnBounty(bounty.id, [
    () => contributeToBounty(bounty.id, user.id, request(10, key)),
    () => contributeToBounty(bounty.id, user.id, request(20, key)),
  ]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  const failure = results.find(row => row.status === "rejected");
  assert.ok(failure?.reason instanceof ContributionIdempotencyConflictError);
  assert.equal((await snapshot()).contributions.length, 2);
  await assertAccounting();
});

test("concurrent contributions cannot overflow aggregate cap", async () => {
  const { bounty } = await seedBounty(MAX_BOUNTY_REWARD_BP - 10);
  const user = await seedUser();
  const other = await seedUser();
  const results = await raceOnBounty(bounty.id, [
    () => contributeToBounty(bounty.id, user.id, request()),
    () => contributeToBounty(bounty.id, other.id, request()),
  ]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.ok(results.find(row => row.status === "rejected")?.reason instanceof BountyRewardLimitError);
  assert.equal((await snapshot()).bounties[0].rewardBp, MAX_BOUNTY_REWARD_BP);
  await assertAccounting();
});

test("concurrent distinct keys cannot spend the same balance twice", async () => {
  const { bounty } = await seedBounty();
  const user = await seedUser(11);
  const results = await raceOnBounty(bounty.id, [
    () => contributeToBounty(bounty.id, user.id, request()),
    () => contributeToBounty(bounty.id, user.id, request()),
  ]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.ok(results.find(row => row.status === "rejected")?.reason instanceof InsufficientBpError);
  await assertAccounting();
});

test("concurrent same key on different bounties conflicts rather than double charging", async () => {
  const first = await seedBounty();
  const second = await seedBounty();
  const user = await seedUser();
  const input = request();
  const results = await raceOnBounty(user.id, [
    () => contributeToBounty(first.bounty.id, user.id, input),
    () => contributeToBounty(second.bounty.id, user.id, input),
  ], "users");
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.ok(results.find(row => row.status === "rejected")?.reason instanceof ContributionIdempotencyConflictError);
  assert.equal((await snapshot()).contributions.length, 3);
  await assertAccounting();
});

test("balance guard works across simultaneous funding of different bounties", async () => {
  const first = await seedBounty();
  const second = await seedBounty();
  const user = await seedUser(11);
  const results = await raceOnBounty(user.id, [
    () => contributeToBounty(first.bounty.id, user.id, request()),
    () => contributeToBounty(second.bounty.id, user.id, request()),
  ], "users");
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.ok(results.find(row => row.status === "rejected")?.reason instanceof InsufficientBpError);
  await assertAccounting();
});

function hasErrorMessage(message: string) {
  return (error: unknown) => {
    let cause = error;
    while (cause instanceof Error) {
      if (cause.message === message) return true;
      cause = cause.cause;
    }
    return false;
  };
}
for (const stage of ["contribution", "funding ledger", "fee ledger", "reward"] as const) {
  test(`${stage} failure rolls back all writes and leaves the key reusable`, async () => {
    const { bounty } = await seedBounty();
    const user = await seedUser(100);
    const input = request();
    const original = await snapshot();
    const table = stage === "contribution" ? "bounty_contributions" : stage === "reward" ? "bounties" : "ledger_entries";
    const event = stage === "reward" ? "UPDATE OF reward_bp" : "INSERT";
    const condition = stage === "funding ledger" ? "NEW.reason = 'bounty_funding'" : stage === "fee ledger" ? "NEW.reason = 'bounty_fee'" : "true";
    const precedingChecks = [
      `IF NOT EXISTS (SELECT 1 FROM users WHERE id = '${user.id}' AND bp_balance = 89) THEN RAISE EXCEPTION 'Expected debit'; END IF;`,
      ...(stage !== "contribution" ? [`IF NOT EXISTS (SELECT 1 FROM bounty_contributions WHERE user_id = '${user.id}' AND idempotency_key = '${input.idempotencyKey}') THEN RAISE EXCEPTION 'Expected contribution'; END IF;`] : []),
      ...(stage === "fee ledger" || stage === "reward" ? [`IF NOT EXISTS (SELECT 1 FROM ledger_entries WHERE user_id = '${user.id}' AND reason = 'bounty_funding') THEN RAISE EXCEPTION 'Expected principal ledger'; END IF;`] : []),
      ...(stage === "reward" ? [`IF NOT EXISTS (SELECT 1 FROM ledger_entries WHERE user_id = '${user.id}' AND reason = 'bounty_fee') THEN RAISE EXCEPTION 'Expected fee ledger'; END IF;`] : []),
    ].join("\n");
    // All interpolated identifiers are fixed test constants and values are generated UUIDs.
    await db.execute(sql.raw(`CREATE OR REPLACE FUNCTION test_contribution_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF ${condition} THEN
        ${precedingChecks}
        RAISE EXCEPTION 'Forced contribution transaction failure';
      END IF; RETURN NEW; END; $$`));
    try {
      await db.execute(sql.raw(`CREATE TRIGGER test_contribution_failure BEFORE ${event} ON ${table}
        FOR EACH ROW EXECUTE FUNCTION test_contribution_failure()`));
      await assert.rejects(() => contributeToBounty(bounty.id, user.id, input), hasErrorMessage("Forced contribution transaction failure"));
      assert.deepEqual(await snapshot(), original);
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS test_contribution_failure ON ${table}`));
      await db.execute(sql`DROP FUNCTION test_contribution_failure()`);
    }
    await contributeToBounty(bounty.id, user.id, input);
    await assertAccounting();
  });
}

for (const closure of ["cancel", "complete"] as const) {
  test(`contribution races with ${closure} without losing funded BP`, async () => {
    const { bounty, creator } = await seedBounty();
    const user = await seedUser(100);
    const winner = await seedUser(0);
    const input = request();
    const close = () => closure === "cancel" ? cancelBounty(bounty.id, creator.osuUserId)
      : completeBounty(bounty.id, 123, { id: winner.id, osuUserId: winner.osuUserId, username: winner.username, coverUrl: null, countryCode: null, countryName: null });
    const results = await raceOnBounty<unknown>(bounty.id, [
      () => contributeToBounty(bounty.id, user.id, input), close,
    ]);
    assert.equal(results[1].status, "fulfilled");
    const funded = results[0].status === "fulfilled";
    if (results[0].status === "rejected") assert.ok(results[0].reason instanceof BountyNotOpenError);
    const state = await snapshot();
    assert.equal(state.bounties[0].rewardBp, funded ? 35 : 25);
    assert.equal(state.bounties[0].status, closure === "cancel" ? "cancelled" : "completed");
    assert.equal(state.users.find(row => row.id === user.id)!.bpBalance, funded ? closure === "cancel" ? 99 : 89 : 100);
    if (closure === "complete") assert.equal(state.users.find(row => row.id === winner.id)!.bpBalance, funded ? 35 : 25);
    if (closure === "cancel") assert.equal(state.ledger.filter(row => row.reason === "bounty_refund" && row.userId === user.id).length, funded ? 1 : 0);
    await assertAccounting();
  });
}
