import assert from "node:assert/strict";
import { metadata } from "./fixtures/completion";
import { createTestDatabase } from "./fixtures/test-database";
import { after, before, beforeEach, mock, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import {
  bounties,
  bountyBeatmaps,
  ledgerEntries,
  users,
} from "../src/db/schema";
import {
  createBountySchema,
  osuBeatmapMetadatatoBountyBeatmapMetadata,
} from "@marksman/contracts";
import { InsufficientBpError } from "../src/services/errors";

// Load the database and service only AFTER selecting the isolated test database.
// Never fall back to DATABASE_URL from the application's .env file.
process.env.DATABASE_URL =
  "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_funding_tests&options=-c%20statement_timeout%3D10000";
Object.assign(process.env, {
  PORT: "3001",
  FRONTEND_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { createFundedBounty } =
  require("../src/services/bounties") as typeof import("../src/services/bounties");

const creatorOsuUserId = 12345;
const testDatabase = createTestDatabase(db);
const username = "test_user";

function bountyInput(rewardBp: number) {
  return createBountySchema.parse({
    rewardBp,
    goal: {
      type: "minimum_grade",
      beatmapId: 123,
      minimumGradeRequirement: "A",
    },
  });
}

async function seedCreator(bpBalance: number) {
  const [creator] = await db
    .insert(users)
    .values({ osuUserId: creatorOsuUserId, username, bpBalance })
    .returning();
  await db
    .insert(ledgerEntries)
    .values({ userId: creator.id, amount: bpBalance, reason: "initial_grant" });
}

async function assertDatabaseState(balance: number, bountyCount: number) {
  const [creator] = await db
    .select()
    .from(users)
    .where(eq(users.osuUserId, creatorOsuUserId));
  assert.ok(creator);
  assert.equal(creator.bpBalance, balance);
  const rows = await db.select().from(bounties);
  assert.equal(rows.length, bountyCount);
  const entries = await db.select().from(ledgerEntries);
  const funding = entries.filter((entry) => entry.reason === "bounty_funding");
  assert.equal(entries.length, 1 + 2 * bountyCount);
  assert.equal(funding.length, bountyCount);
  const fees = entries.filter((entry) => entry.reason === "bounty_fee");
  assert.equal(fees.length, bountyCount);
  for (const bounty of rows) {
    assert.deepEqual(
      fees
        .filter((entry) => entry.bountyId === bounty.id)
        .map(({ userId, amount }) => ({ userId, amount })),
      [
        {
          userId: creator.id,
          amount: -Math.ceil(bounty.rewardBp / 10),
        },
      ],
    );
    assert.deepEqual(
      funding
        .filter((entry) => entry.bountyId === bounty.id)
        .map(({ userId, amount, reason, bountyId }) => ({
          userId,
          amount,
          reason,
          bountyId,
        })),
      [
        {
          userId: creator.id,
          amount: -bounty.rewardBp,
          reason: "bounty_funding",
          bountyId: bounty.id,
        },
      ],
    );
  }
  assert.equal(
    entries.reduce((sum, entry) => sum + entry.amount, 0),
    balance,
  );
  return rows;
}

before(async () => {
  mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://osu.ppy.sh/oauth/token") {
        return Response.json({
          access_token: "fixture-token",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      if (url === "https://osu.ppy.sh/api/v2/beatmaps/123")
        return Response.json({ ...metadata, id: 123 });
      throw new Error(`Unexpected fetch: ${url}; live requests are disabled`);
    },
  );
  await testDatabase.prepare();
});

// These tests share fixtures and must run sequentially. Only the concurrency
// test below deliberately executes two service calls at the same time.
beforeEach(async () => {
  await testDatabase.clear();
  await db.delete(bountyBeatmaps);
});

after(async () => {
  try {
    await testDatabase.clearIfMigrated();
    await db.delete(bountyBeatmaps);
  } finally {
    mock.restoreAll();
    await db.$client.end();
  }
});

test("funding creates one bounty and deducts reward plus fee", async () => {
  await seedCreator(100);
  const input = bountyInput(30);
  input.goal.beatmapChecksum = "ffffffffffffffffffffffffffffffff";

  const created = await createFundedBounty(input, creatorOsuUserId);

  const [stored] = await assertDatabaseState(67, 1);
  assert.equal(stored.id, created.id);
  assert.equal(stored.status, "open");
  assert.equal(stored.rewardBp, 30);
  assert.equal(stored.creatorOsuUserId, creatorOsuUserId);
  assert.deepEqual(stored.goal, {
    ...input.goal,
    beatmapChecksum: metadata.checksum,
  });
  assert.equal(created.goal.beatmapChecksum, metadata.checksum);
  const [savedMetadata] = await db.select().from(bountyBeatmaps);
  assert.equal(savedMetadata.beatmapId, input.goal.beatmapId);
  assert.equal(savedMetadata.metadata.version.name, metadata.version);
  assert.equal(savedMetadata.metadata.specs.od, metadata.accuracy);
  assert.equal(savedMetadata.metadata.song, null);
});

test("insufficient funds leave the balance and bounties unchanged", async () => {
  await seedCreator(20);

  await assert.rejects(
    () => createFundedBounty(bountyInput(30), creatorOsuUserId),
    InsufficientBpError,
  );

  await assertDatabaseState(20, 0);
});

test("spending the exact balance succeeds and leaves zero BP", async () => {
  await seedCreator(33);

  await createFundedBounty(bountyInput(30), creatorOsuUserId);

  await assertDatabaseState(0, 1);
});

test("a failed bounty insert rolls back the preceding deduction", async () => {
  await seedCreator(100);

  // A real database error, after verifying the deduction happened inside tx.
  // This function and trigger exist only in the separate test database.
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_bounty_insert() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF (SELECT bp_balance FROM users WHERE osu_user_id = NEW.creator_osu_user_id)
         IS DISTINCT FROM 67 THEN
        RAISE EXCEPTION 'Test expected deduction before insert';
      END IF;
      RAISE EXCEPTION 'Forced bounty insertion failure';
    END;
    $$
  `);

  try {
    await db.execute(sql`
      CREATE TRIGGER test_reject_bounty_insert
      BEFORE INSERT ON bounties
      FOR EACH ROW EXECUTE FUNCTION test_reject_bounty_insert()
    `);

    await assert.rejects(
      () => createFundedBounty(bountyInput(30), creatorOsuUserId),
      (error: unknown) => {
        // Drizzle can wrap the original PostgreSQL error in .cause.
        let cause: unknown = error;
        while (cause instanceof Error) {
          if (cause.message === "Forced bounty insertion failure") return true;
          cause = cause.cause;
        }
        return false;
      },
    );

    await assertDatabaseState(100, 0);
  } finally {
    await db.execute(
      sql`DROP TRIGGER IF EXISTS test_reject_bounty_insert ON bounties`,
    );
    await db.execute(sql`DROP FUNCTION test_reject_bounty_insert()`);
  }
});

test("concurrent requests cannot spend the same available BP", async () => {
  await seedCreator(100);
  const blocker = await db.$client.connect();
  let requests: Promise<PromiseSettledResult<unknown>[]> | undefined;

  try {
    // Hold the user row until BOTH service calls are waiting to deduct BP.
    await blocker.query("BEGIN");
    await blocker.query(
      "SELECT id FROM users WHERE osu_user_id = $1 FOR UPDATE",
      [creatorOsuUserId],
    );
    requests = Promise.allSettled([
      createFundedBounty(bountyInput(50), creatorOsuUserId),
      createFundedBounty(bountyInput(50), creatorOsuUserId),
    ]);

    const deadline = Date.now() + 5000;
    while (true) {
      const { rows } = await db.$client.query(`
        SELECT count(*)::integer AS waiting
        FROM pg_stat_activity
        WHERE application_name = 'marksman_funding_tests'
          AND datname = current_database()
          AND wait_event_type = 'Lock'
      `);
      if (rows[0].waiting >= 2) break;
      assert.ok(
        Date.now() < deadline,
        "Both funding requests should wait on the row lock",
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
    assert.ok(failures[0].reason instanceof InsufficientBpError);
    const [stored] = await assertDatabaseState(45, 1);
    assert.equal(stored.rewardBp, 50);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    // Let outstanding requests finish before fixture cleanup, even on failure.
    await requests;
  }
});

test("funding ledger failure rolls back all changes and allows retry", async () => {
  await seedCreator(100);
  const snapshot = async () => ({
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
    beatmaps: await db
      .select()
      .from(bountyBeatmaps)
      .orderBy(bountyBeatmaps.beatmapId),
  });
  const original = await snapshot();
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_funding_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.reason = 'bounty_funding' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND bp_balance = 67)
          OR NOT EXISTS (SELECT 1 FROM bounties WHERE id = NEW.bounty_id AND status = 'open') THEN
          RAISE EXCEPTION 'Test expected balance and bounty changes before ledger insert';
        END IF;
        RAISE EXCEPTION 'Forced funding ledger failure';
      END IF;
      RETURN NEW;
    END; $$
  `);
  try {
    await db.execute(sql`CREATE TRIGGER test_reject_funding_ledger BEFORE INSERT ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION test_reject_funding_ledger()`);
    await assert.rejects(
      () => createFundedBounty(bountyInput(30), creatorOsuUserId),
      (error: unknown) => {
        let cause = error;
        while (cause instanceof Error) {
          if (cause.message === "Forced funding ledger failure") return true;
          cause = cause.cause;
        }
        return false;
      },
    );
    assert.deepEqual(await snapshot(), original);
    await assertDatabaseState(100, 0);
  } finally {
    await db.execute(
      sql`DROP TRIGGER IF EXISTS test_reject_funding_ledger ON ledger_entries`,
    );
    await db.execute(sql`DROP FUNCTION test_reject_funding_ledger()`);
  }
  await createFundedBounty(bountyInput(30), creatorOsuUserId);
  await assertDatabaseState(67, 1);
});

for (const [reward, fee] of [
  [1, 1],
  [25, 3],
  [30, 3],
] as const) {
  test(`reward ${reward} charges a rounded-up fee of ${fee}`, async () => {
    await seedCreator(100);
    const bounty = await createFundedBounty(
      bountyInput(reward),
      creatorOsuUserId,
    );
    await assertDatabaseState(100 - reward - fee, 1);
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.bountyId, bounty.id));
    assert.deepEqual(
      entries
        .map(({ reason, amount }) => ({ reason, amount }))
        .sort((a, b) => a.reason.localeCompare(b.reason)),
      [
        { reason: "bounty_fee", amount: -fee },
        { reason: "bounty_funding", amount: -reward },
      ],
    );
  });
}

for (const balance of [25, 27]) {
  test(`balance ${balance} covers reward but cannot cover the full fee`, async () => {
    await seedCreator(balance);
    await assert.rejects(
      () => createFundedBounty(bountyInput(25), creatorOsuUserId),
      InsufficientBpError,
    );
    await assertDatabaseState(balance, 0);
  });
}

test("fee ledger failure rolls back debit, bounty and funding entry and allows retry", async () => {
  await seedCreator(100);
  const snapshot = async () => ({
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
    beatmaps: await db
      .select()
      .from(bountyBeatmaps)
      .orderBy(bountyBeatmaps.beatmapId),
  });
  const original = await snapshot();
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_fee_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.reason = 'bounty_fee' THEN
        IF NEW.amount <> -3
          OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND bp_balance = 72)
          OR NOT EXISTS (SELECT 1 FROM bounties WHERE id = NEW.bounty_id AND reward_bp = 25 AND status = 'open')
          OR NOT EXISTS (SELECT 1 FROM ledger_entries WHERE bounty_id = NEW.bounty_id
            AND user_id = NEW.user_id AND reason = 'bounty_funding' AND amount = -25) THEN
          RAISE EXCEPTION 'Test expected debit, bounty and funding entry before fee';
        END IF;
        RAISE EXCEPTION 'Forced fee ledger failure';
      END IF;
      RETURN NEW;
    END; $$
  `);
  try {
    await db.execute(sql`CREATE TRIGGER test_reject_fee_ledger BEFORE INSERT ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION test_reject_fee_ledger()`);
    await assert.rejects(
      () => createFundedBounty(bountyInput(25), creatorOsuUserId),
      (error: unknown) => {
        let cause = error;
        while (cause instanceof Error) {
          if (cause.message === "Forced fee ledger failure") return true;
          cause = cause.cause;
        }
        return false;
      },
    );
    assert.deepEqual(await snapshot(), original);
    await assertDatabaseState(100, 0);
  } finally {
    await db.execute(
      sql`DROP TRIGGER IF EXISTS test_reject_fee_ledger ON ledger_entries`,
    );
    await db.execute(sql`DROP FUNCTION test_reject_fee_ledger()`);
  }
  await createFundedBounty(bountyInput(25), creatorOsuUserId);
  await assertDatabaseState(72, 1);
});

test("creating another bounty refreshes the shared metadata without duplicating it", async () => {
  await seedCreator(100);
  await db.insert(bountyBeatmaps).values({
    beatmapId: 123,
    metadata: osuBeatmapMetadatatoBountyBeatmapMetadata({
      ...metadata,
      id: 123,
      version: "Old version",
    }),
    updatedAt: new Date("2020-01-01T00:00:00Z"),
  });
  await createFundedBounty(bountyInput(10), creatorOsuUserId);
  await createFundedBounty(bountyInput(10), creatorOsuUserId);
  const rows = await db.select().from(bountyBeatmaps);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].metadata.version.name, metadata.version);
  assert.ok(
    rows[0].updatedAt.getTime() > new Date("2020-01-01T00:00:00Z").getTime(),
  );
  await assertDatabaseState(78, 2);
});
