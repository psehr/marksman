CREATE TYPE "public"."ledger_entry_reason" AS ENUM('bounty_funding', 'bounty_refund', 'bounty_reward', 'initial_grant', 'daily_claim');--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" "ledger_entry_reason" NOT NULL,
	"bounty_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_reason_amount_bounty_check" CHECK (
    (
      "ledger_entries"."reason" = 'initial_grant'
      AND "ledger_entries"."amount" > 0
      AND "ledger_entries"."bounty_id" IS NULL
    )
    OR
    (
      "ledger_entries"."reason" = 'bounty_funding'
      AND "ledger_entries"."amount" < 0
      AND "ledger_entries"."bounty_id" IS NOT NULL
    )
    OR
    (
      "ledger_entries"."reason" IN ('bounty_refund', 'bounty_reward')
      AND "ledger_entries"."amount" > 0
      AND "ledger_entries"."bounty_id" IS NOT NULL
    )
  )
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;