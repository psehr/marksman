CREATE TABLE "daily_claims" (
	"user_id" uuid NOT NULL,
	"claim_date" date NOT NULL,
	CONSTRAINT "daily_claims_user_id_claim_date_pk" PRIMARY KEY("user_id","claim_date")
);
--> statement-breakpoint
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_reason_amount_bounty_check";--> statement-breakpoint
ALTER TABLE "daily_claims" ADD CONSTRAINT "daily_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reason_amount_bounty_check" CHECK (
    (
      "ledger_entries"."reason" IN ('initial_grant', 'daily_claim')
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
  );