import assert from "node:assert/strict";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { db as applicationDb } from "../../src/db";

type TestDb = typeof applicationDb;

export function createTestDatabase(db: TestDb, includeSessions = false) {
  let migrated = false;

  async function clear() {
    if (includeSessions) {
      await db.execute(
        sql`TRUNCATE TABLE sessions, daily_claims, ledger_entries, bounty_bookmarks, bounties, users, bounty_hunts`,
      );
    } else {
      await db.execute(
        sql`TRUNCATE TABLE daily_claims, ledger_entries, bounty_bookmarks, bounties, users, bounty_hunts`,
      );
    }
  }

  return {
    async prepare() {
      const { rows } = await db.$client.query(
        "SELECT current_database() AS database, current_user AS role",
      );
      assert.equal(rows[0].database, "marksman_test");
      assert.equal(rows[0].role, "marksman_test");
      await migrate(db, {
        migrationsFolder: resolve(__dirname, "../../drizzle"),
      });
      migrated = true;
    },
    clear,
    async clearIfMigrated() {
      if (migrated) await clear();
    },
  };
}
