import assert from "node:assert/strict";
import { createTestDatabase } from "./fixtures/test-database";
import { after, before, beforeEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { ledgerEntries, users } from "../src/db/schema";
import { userSchema, type User } from "@marksman/contracts";

// Select the isolated database before loading modules that initialize the pool.
process.env.DATABASE_URL =
  "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_user_tests&options=-c%20statement_timeout%3D10000";
const { db } = require("../src/db") as typeof import("../src/db");
const { registerOrUpdateUserFromOsuProfile } =
  require("../src/services/users") as typeof import("../src/services/users");

const profile = { osuUserId: 12345, username: "original_name" };
const testDatabase = createTestDatabase(db);

before(async () => {
  await testDatabase.prepare();
});

beforeEach(async () => {
  await testDatabase.clear();
});

after(async () => {
  try {
    await testDatabase.clearIfMigrated();
  } finally {
    await db.$client.end();
  }
});

async function assertStoredUser(expected: User) {
  const rows = await db.select().from(users);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { ...rows[0], createdAt: rows[0].createdAt.toISOString() },
    { ...expected.identity, ...expected.stats, createdAt: expected.createdAt },
  );
}

async function assertGrant(user: User) {
  const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.userId, user.identity.id));
  assert.equal(entries.length, 1);
  assert.deepEqual(entries.map(({ userId, amount, reason, bountyId }) => ({ userId, amount, reason, bountyId })), [{
    userId: user.identity.id, amount: 330, reason: "initial_grant", bountyId: null,
  }]);
  assert.ok(entries[0].createdAt instanceof Date);
}

test("first login creates a user with the supplied profile and one 330 BP grant", async () => {
  const user = await registerOrUpdateUserFromOsuProfile(profile);

  userSchema.parse(user);
  assert.equal(user.identity.osuUserId, profile.osuUserId);
  assert.equal(user.identity.username, profile.username);
  assert.equal(user.stats.bpBalance, 330);
  await assertStoredUser(user);
  await assertGrant(user);
});

test("repeat login returns and stores the new username while preserving account data", async () => {
  const [original] = await db
    .insert(users)
    .values({
      ...profile,
      bpBalance: 275,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    })
    .returning();

  await db.insert(ledgerEntries).values({ userId: original.id, amount: 275, reason: "initial_grant" });
  const originalLedger = await db.select().from(ledgerEntries);
  const updated = await registerOrUpdateUserFromOsuProfile({
    ...profile,
    username: "renamed_player",
  });

  const expected: User = {
    identity: {
      id: original.id,
      osuUserId: profile.osuUserId,
      username: "renamed_player",
    },
    stats: { bpBalance: 275 },
    createdAt: original.createdAt.toISOString(),
  };
  assert.deepEqual(updated, expected);
  await assertStoredUser(expected);
  assert.deepEqual(await db.select().from(ledgerEntries), originalLedger);
});

test("concurrent first logins both return the same single account", async () => {
  const blocker = await db.$client.connect();
  let requests: Promise<PromiseSettledResult<User>[]> | undefined;

  try {
    await blocker.query("BEGIN");
    // Keep the table empty while both first-login inserts reach the database.
    await blocker.query("LOCK TABLE users IN SHARE MODE");
    requests = Promise.allSettled([
      registerOrUpdateUserFromOsuProfile(profile),
      registerOrUpdateUserFromOsuProfile(profile),
    ]);

    const deadline = Date.now() + 5000;
    while (true) {
      const { rows } = await db.$client.query(`
        SELECT count(*)::integer AS waiting
        FROM pg_stat_activity
        WHERE application_name = 'marksman_user_tests'
          AND datname = current_database()
          AND wait_event_type = 'Lock'
      `);
      if (rows[0].waiting >= 2) break;
      assert.ok(
        Date.now() < deadline,
        "Both login requests should wait on the table lock",
      );
      await delay(20);
    }

    await blocker.query("COMMIT");
    const results = await requests;
    const returned = results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    assert.deepEqual(returned[0], returned[1]);
    assert.equal(returned[0].identity.osuUserId, profile.osuUserId);
    assert.equal(returned[0].identity.username, profile.username);
    assert.equal(returned[0].stats.bpBalance, 330);
    await assertStoredUser(returned[0]);
    await assertGrant(returned[0]);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    // Drain requests before fixture cleanup, including when an assertion fails.
    await requests;
  }
});


test("returning logins do not regrant BP or modify another account", async () => {
  const other = await registerOrUpdateUserFromOsuProfile({ osuUserId: 67890, username: "other_player" });
  const first = await registerOrUpdateUserFromOsuProfile(profile);
  const originalLedger = await db.select().from(ledgerEntries).orderBy(ledgerEntries.id);
  for (const username of ["renamed_once", "renamed_twice"]) {
    const returned = await registerOrUpdateUserFromOsuProfile({ ...profile, username });
    assert.deepEqual(returned, { ...first, identity: { ...first.identity, username } });
  }
  const [storedOther] = await db.select().from(users).where(eq(users.id, other.identity.id));
  assert.deepEqual({ ...storedOther, createdAt: storedOther.createdAt.toISOString() }, {
    ...other.identity, ...other.stats, createdAt: other.createdAt,
  });
  assert.deepEqual(await db.select().from(ledgerEntries).orderBy(ledgerEntries.id), originalLedger);
  await assertGrant(first);
  await assertGrant(other);
});

test("grant insertion failure rolls back account creation and a retry grants once", async () => {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION test_reject_initial_grant() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.reason = 'initial_grant' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND bp_balance = 330) THEN
          RAISE EXCEPTION 'Test expected funded account before ledger insert';
        END IF;
        RAISE EXCEPTION 'Forced initial grant failure';
      END IF;
      RETURN NEW;
    END; $$
  `);
  try {
    await db.execute(sql`CREATE TRIGGER test_reject_initial_grant BEFORE INSERT ON ledger_entries
      FOR EACH ROW EXECUTE FUNCTION test_reject_initial_grant()`);
    await assert.rejects(() => registerOrUpdateUserFromOsuProfile(profile), (error: unknown) => {
      let cause = error;
      while (cause instanceof Error) {
        if (cause.message === "Forced initial grant failure") return true;
        cause = cause.cause;
      }
      return false;
    });
    assert.deepEqual(await db.select().from(users), []);
    assert.deepEqual(await db.select().from(ledgerEntries), []);
  } finally {
    await db.execute(sql`DROP TRIGGER IF EXISTS test_reject_initial_grant ON ledger_entries`);
    await db.execute(sql`DROP FUNCTION test_reject_initial_grant()`);
  }
  const user = await registerOrUpdateUserFromOsuProfile(profile);
  assert.equal(user.stats.bpBalance, 330);
  await assertStoredUser(user);
  await assertGrant(user);
});
