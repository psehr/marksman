import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  index,
  json,
  varchar,
  text,
  bigint,
} from "drizzle-orm/pg-core";
import {
  huntStatusEnum,
  ledgerEntryReasonSchema,
  type Bounty,
} from "@marksman/contracts";
import { primaryKey } from "drizzle-orm/pg-core";
import { date } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

export const bountyStatus = pgEnum("bounty_status", [
  "draft",
  "open",
  "completed",
  "cancelled",
]);

export const bounties = pgTable(
  "bounties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: bountyStatus("status").notNull(),
    rewardBp: integer("reward_bp").notNull(),
    goal: jsonb("goal").$type<Bounty["goal"]>().notNull(),
    creatorOsuUserId: integer("creator_osu_user_id").notNull(),
    completedByOsuUserId: integer("completed_by_osu_user_id"),
    completionScoreId: bigint("completion_score_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [check("bounties_reward_bp_positive", sql`${table.rewardBp} > 0`)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    osuUserId: integer("osu_user_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    bpBalance: integer("bp_balance").default(0).notNull(),
  },
  (table) => [check("bp_balance", sql`${table.bpBalance} >= 0`)],
);

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", {
      precision: 6,
      withTimezone: false,
    }).notNull(),
  },
  (table) => [index("sessions_expire_idx").on(table.expire)],
);

export const bountyBookmarks = pgTable(
  "bounty_bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    bountyId: uuid("bounty_id")
      .notNull()
      .references(() => bounties.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.bountyId] }),
    index("bounty_bookmarks_bounty_id_idx").on(table.bountyId),
  ],
);

export const ledgerEntryReasonEnum = pgEnum(
  "ledger_entry_reason",
  ledgerEntryReasonSchema.enum,
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amount: integer("amount").notNull(),
    reason: ledgerEntryReasonEnum("reason").notNull(),
    bountyId: uuid("bounty_id").references(() => bounties.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "ledger_entries_reason_amount_bounty_check",
      sql`
    (
      ${table.reason} IN ('initial_grant', 'daily_claim')
      AND ${table.amount} > 0
      AND ${table.bountyId} IS NULL
    )
    OR
    (
      ${table.reason}::text IN ('bounty_funding', 'bounty_fee')
      AND ${table.amount} < 0
      AND ${table.bountyId} IS NOT NULL
    )
    OR
    (
      ${table.reason} IN ('bounty_refund', 'bounty_reward')
      AND ${table.amount} > 0
      AND ${table.bountyId} IS NOT NULL
    )
  `,
    ),
  ],
);

export const dailyClaims = pgTable(
  "daily_claims",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    claimDate: date("claim_date").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.claimDate] })],
);

export const bountyHuntStatus = pgEnum(
  "bounty_hunt_status",
  huntStatusEnum.enum,
);

export const bountyHunts = pgTable(
  "bounty_hunts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    bountyId: uuid("bounty_id")
      .notNull()
      .references(() => bounties.id),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: bountyHuntStatus("status").notNull(),
  },
  (table) => [
    check(
      "bounty_hunts_end_after_start",
      sql`${table.endedAt} >= ${table.startedAt}`,
    ),
    check(
      "bounty_hunts_valid_ended_at",
      sql`
      (${table.status} = 'ongoing' AND ${table.endedAt} IS NULL)
      OR
      (${table.status} IN ('stopped', 'closed') AND ${table.endedAt} IS NOT NULL)
      `,
    ),
    uniqueIndex("bounty_hunts_one_ongoing_per_user_bounty")
      .on(table.userId, table.bountyId)
      .where(sql`${table.status} = 'ongoing'`),
    index("bounty_hunts_ongoing_hunts")
      .on(table.userId)
      .where(sql`${table.status} = 'ongoing'`),
  ],
);
