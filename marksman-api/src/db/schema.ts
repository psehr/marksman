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
  huntAttemptStatusEnum,
  HuntAttemptScoreEvidence,
  HuntAttemptVerificationResult,
  BountyBeatmapMetadata,
} from "@marksman/contracts";
import { primaryKey } from "drizzle-orm/pg-core";
import { date } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { unique } from "drizzle-orm/pg-core";

export const bountyStatus = pgEnum("bounty_status", [
  "draft",
  "open",
  "completed",
  "cancelled",
]);

// This table stores all the bounties, data not enriched
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

// This table stores all the users, data not enriched
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

// This table stores all user sessions, for login persistence with a cookie
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

// This table stores user-bounty bookmarks
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

// This table stores all BP transactions for tracability
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

// This table stores the last daily BP claim for every user
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

// This tables stores all the user-bounty hunts
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

export const verificationStatusEnum = pgEnum(
  "verification_status_enum",
  huntAttemptStatusEnum.enum,
);

// This table stores all the possible current attempts on ongoing bounty-hunts
export const huntAttempts = pgTable(
  "hunt_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    huntId: uuid("hunt_id")
      .notNull()
      .references(() => bountyHunts.id),
    scoreId: bigint("score_id", { mode: "number" }).notNull(),
    scoreEndedAt: timestamp("score_ended_at", { withTimezone: true }).notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull(),
    scoreEvidence: jsonb("score_evidence")
      .notNull()
      .$type<HuntAttemptScoreEvidence>(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    verificationResult: jsonb(
      "verification_result",
    ).$type<HuntAttemptVerificationResult>(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verificationAttempts: integer("verification_attempts").notNull().default(0),
    nextVerificationAt: timestamp("next_verification_at", {
      withTimezone: true,
    }),
    lastVerificationError: text("last_verification_error"),
  },
  (table) => [
    unique("hunt_attempts_hunt_id_score_id_unique").on(
      table.huntId,
      table.scoreId,
    ),
    check(
      "hunt_attempts_verification_state_check",
      sql`
      (${table.verificationStatus} = 'pending' AND ${table.verificationResult} IS NULL AND ${table.verifiedAt} IS NULL)
      OR
      (${table.verificationStatus} IN ('valid', 'invalid') AND ${table.verificationResult} IS NOT NULL AND ${table.verifiedAt} IS NOT NULL)
      `,
    ),
  ],
);

// This table stores the osu! scorefeed lookup cursor position, to recover from eventual outages or API throttling
export const scoreDiscoveryCursors = pgTable("score_discovery_cursors", {
  stream: text("stream").primaryKey(),
  cursor: text("cursor").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// This table stores all the bounty settlements, which happens when a valid candidate for bounty completion is found in the hunt attempts
export const bountySettlements = pgTable("bounty_settlements", {
  bountyId: uuid("bounty_id")
    .notNull()
    .primaryKey()
    .references(() => bounties.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  settleAfter: timestamp("settle_after", { withTimezone: true }).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

// This table stores the beatmap metadata of all the bounties, this is for filtering and searching bounties by osu! metadata
export const bountyBeatmaps = pgTable("bounty_beatmaps", {
  beatmapId: integer("beatmap_id").notNull().primaryKey(),
  metadata: jsonb("metadata").notNull().$type<BountyBeatmapMetadata>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
