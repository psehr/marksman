import assert from "node:assert/strict";
import { metadata } from "./fixtures/completion";
import { createTestDatabase } from "./fixtures/test-database";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, mock, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { bounties, ledgerEntries, users } from "../src/db/schema";
import { createBountySchema } from "@marksman/contracts";
import {
  BountyNotFoundError,
  BountyNotOpenError,
  BountyNotOwnedError,
} from "../src/services/errors";

// Select the isolated database before loading modules that initialize the pool.
process.env.DATABASE_URL =
  "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_cancellation_tests&options=-c%20statement_timeout%3D10000";
Object.assign(process.env, {
  PORT: "3001", FRONTEND_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "123", OSU_CLIENT_SECRET: "fixture-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { cancelBounty, createFundedBounty } =
  require("../src/services/bounties") as typeof import("../src/services/bounties");

const creatorOsuUserId = 12345;
const testDatabase = createTestDatabase(db);
const username = "test_user";

before(async () => {
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://osu.ppy.sh/oauth/token") {
      return Response.json({ access_token: "fixture-token", token_type: "Bearer", expires_in: 3600 });
    }
    if (url === "https://osu.ppy.sh/api/v2/beatmaps/123") return Response.json(metadata);
    throw new Error(`Unexpected fetch: ${url}; live requests are disabled`);
  });
  await testDatabase.prepare();
});

beforeEach(async () => {
  await testDatabase.clear();
});

after(async () => {
  try {
    await testDatabase.clearIfMigrated();
  } finally {
    mock.restoreAll();
    await db.$client.end();
  }
});

async function seedFundedBounty() {
  const [creator] = await db.insert(users).values({
    osuUserId: creatorOsuUserId,
    username: username,
    bpBalance: 100,
  }).returning();
  await db.insert(ledgerEntries).values({ userId: creator.id, amount: 100, reason: "initial_grant" });
  return createFundedBounty(
    createBountySchema.parse({
      rewardBp: 25,
      goal: {
        type: "minimum_grade",
        beatmapId: 123,
        minimumGradeRequirement: "A",
      },
    }),
    creatorOsuUserId,
  );
}

async function assertState(
  bountyId: string,
  status: typeof bounties.$inferSelect.status,
  balance: number,
) {
  const rows = await db.select().from(bounties);
  assert.equal(
    rows.length,
    1,
    "Cancellation should preserve the bounty record",
  );
  assert.equal(rows[0].id, bountyId);
  assert.equal(rows[0].status, status);
  const [creator] = await db
    .select()
    .from(users)
    .where(eq(users.osuUserId, creatorOsuUserId));
  assert.ok(creator);
  assert.equal(creator.bpBalance, balance);
  const entries = await db.select().from(ledgerEntries);
  const linked = entries.filter(entry => entry.bountyId === bountyId);
  const expected = [{ userId: creator.id, amount: -rows[0].rewardBp, reason: "bounty_funding", bountyId }];
  expected.push({ userId: creator.id, amount: -3, reason: "bounty_fee", bountyId });
  if (status === "cancelled") expected.push({ userId: creator.id, amount: rows[0].rewardBp, reason: "bounty_refund", bountyId });
  assert.deepEqual(linked.map(({ userId, amount, reason, bountyId }) => ({ userId, amount, reason, bountyId })).sort((a, b) => a.amount - b.amount), expected);
  const allUsers = await db.select().from(users);
  assert.equal(entries.length, allUsers.length + expected.length);
  for (const user of allUsers) {
    assert.equal(entries.filter(entry => entry.userId === user.id).reduce((sum, entry) => sum + entry.amount, 0), user.bpBalance);
  }
}

test("cancellation refunds the 25 BP reward but retains the 3 BP fee", async () => {
  const bounty = await seedFundedBounty();
  await assertState(bounty.id, "open", 72);

  const cancelled = await cancelBounty(bounty.id, creatorOsuUserId);

  assert.ok(cancelled.cancelledAt);
  assert.ok(Number.isFinite(Date.parse(cancelled.cancelledAt)));
  const [stored] = await db.select().from(bounties).where(eq(bounties.id, bounty.id));
  assert.equal(cancelled.cancelledAt, stored.cancelledAt?.toISOString());
  assert.deepEqual(cancelled, { ...bounty, status: "cancelled", cancelledAt: cancelled.cancelledAt });
  await assertState(bounty.id, "cancelled", 97);
});

test("another user cannot cancel the bounty or receive its reward", async () => {
  const bounty = await seedFundedBounty();
  const otherUserId = 54321;
  const [otherUser] = await db.insert(users)
    .values({ osuUserId: otherUserId, username, bpBalance: 50 }).returning();
  await db.insert(ledgerEntries).values({ userId: otherUser.id, amount: 50, reason: "initial_grant" });

  await assert.rejects(
    () => cancelBounty(bounty.id, otherUserId),
    BountyNotOwnedError,
  );

  await assertState(bounty.id, "open", 72);
  const [other] = await db
    .select()
    .from(users)
    .where(eq(users.osuUserId, otherUserId));
  assert.equal(other.bpBalance, 50);
});

test("a second cancellation cannot refund the bounty again", async () => {
  const bounty = await seedFundedBounty();
  await cancelBounty(bounty.id, creatorOsuUserId);

  await assert.rejects(
    () => cancelBounty(bounty.id, creatorOsuUserId),
    BountyNotOpenError,
  );

  await assertState(bounty.id, "cancelled", 97);
});

test("a missing bounty produces the specific not-found error", async () => {
  const existing = await seedFundedBounty();

  await assert.rejects(
    () => cancelBounty(randomUUID(), creatorOsuUserId),
    BountyNotFoundError,
  );

  await assertState(existing.id, "open", 72);
});

for (const status of ["draft", "completed"] as const) {
  test(`a ${status} bounty cannot be cancelled or refunded`, async () => {
    const bounty = await seedFundedBounty();
    // Arrange each non-open state directly to isolate cancellation behavior.
    await db.update(bounties).set({ status }).where(eq(bounties.id, bounty.id));

    await assert.rejects(
      () => cancelBounty(bounty.id, creatorOsuUserId),
      BountyNotOpenError,
    );

    await assertState(bounty.id, status, 72);
  });
}

test("a database refund error rolls back the cancellation", async () => {
  const bounty = await seedFundedBounty();
  // Verify the status update happened before forcing the credit to fail.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_refund() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM bounties
        WHERE creator_osu_user_id = NEW.osu_user_id AND status = 'cancelled'
      ) THEN
        RAISE EXCEPTION 'Test expected cancellation before refund';
      END IF;
      RAISE EXCEPTION 'Forced refund failure';
    END;
    $$
  `);

  try {
    await db.execute(sql`
      CREATE TRIGGER test_reject_refund
      BEFORE UPDATE OF bp_balance ON users
      FOR EACH ROW EXECUTE FUNCTION test_reject_refund()
    `);

    await assert.rejects(
      () => cancelBounty(bounty.id, creatorOsuUserId),
      (error: unknown) => {
        let cause = error;
        while (cause instanceof Error) {
          if (cause.message === "Forced refund failure") return true;
          cause = cause.cause;
        }
        return false;
      },
    );

    await assertState(bounty.id, "open", 72);
  } finally {
    await db.execute(sql`DROP TRIGGER IF EXISTS test_reject_refund ON users`);
    await db.execute(sql`DROP FUNCTION test_reject_refund()`);
  }
});

test("a missing refund recipient rolls back the cancellation", async () => {
  const bounty = await seedFundedBounty();
  // Arrange an orphaned creator reference without deleting immutable ledger history.
  // Bounty ownership currently has no user foreign key.
  const missingCreator = 99999;
  await db.update(bounties).set({ creatorOsuUserId: missingCreator }).where(eq(bounties.id, bounty.id));

  await assert.rejects(() => cancelBounty(bounty.id, missingCreator), {
    message: "Could not refund, cancellation aborted",
  });

  const rows = await db.select().from(bounties);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, bounty.id);
  assert.equal(rows[0].status, "open");
  await assertState(bounty.id, "open", 72);
});

test("concurrent cancellations refund the bounty exactly once", async () => {
  const bounty = await seedFundedBounty();
  const blocker = await db.$client.connect();
  let requests: Promise<PromiseSettledResult<unknown>[]> | undefined;

  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM bounties WHERE id = $1 FOR UPDATE", [
      bounty.id,
    ]);
    requests = Promise.allSettled([
      cancelBounty(bounty.id, creatorOsuUserId),
      cancelBounty(bounty.id, creatorOsuUserId),
    ]);

    // Release the row only once both cancellations contend for its lock.
    const deadline = Date.now() + 5000;
    while (true) {
      const { rows } = await db.$client.query(`
        SELECT count(*)::integer AS waiting
        FROM pg_stat_activity
        WHERE application_name = 'marksman_cancellation_tests'
          AND datname = current_database()
          AND wait_event_type = 'Lock'
      `);
      if (rows[0].waiting >= 2) break;
      assert.ok(
        Date.now() < deadline,
        "Both cancellations should wait on the row lock",
      );
      await delay(20);
    }

    await blocker.query("COMMIT");
    const results = await requests;
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const failures = results.filter((result) => result.status === "rejected");
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason instanceof BountyNotOpenError);
    await assertState(bounty.id, "cancelled", 97);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await requests;
  }
});


test("cancellation ledger failure rolls back all changes and allows retry", async () => {
  const bounty = await seedFundedBounty();
  const snapshot = async () => ({
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
  });
  const original = await snapshot();
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_cancellation_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.reason = 'bounty_refund' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND bp_balance = 97)
          OR NOT EXISTS (SELECT 1 FROM bounties WHERE id = NEW.bounty_id AND status = 'cancelled') THEN
          RAISE EXCEPTION 'Test expected balance and bounty changes before ledger insert';
        END IF;
        RAISE EXCEPTION 'Forced cancellation ledger failure';
      END IF;
      RETURN NEW;
    END; $$
  `);
  try {
    await db.execute(sql`CREATE TRIGGER test_reject_cancellation_ledger BEFORE INSERT ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION test_reject_cancellation_ledger()`);
    await assert.rejects(() => cancelBounty(bounty.id, creatorOsuUserId), (error: unknown) => {
      let cause = error;
      while (cause instanceof Error) {
        if (cause.message === "Forced cancellation ledger failure") return true;
        cause = cause.cause;
      }
      return false;
    });
    assert.deepEqual(await snapshot(), original);
    await assertState(bounty.id, "open", 72);
  } finally {
    await db.execute(sql`DROP TRIGGER IF EXISTS test_reject_cancellation_ledger ON ledger_entries`);
    await db.execute(sql`DROP FUNCTION test_reject_cancellation_ledger()`);
  }
  await cancelBounty(bounty.id, creatorOsuUserId);
  await assertState(bounty.id, "cancelled", 97);
});
