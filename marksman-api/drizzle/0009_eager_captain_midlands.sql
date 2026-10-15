ALTER TYPE "public"."ledger_entry_reason" ADD VALUE 'bounty_fee' BEFORE 'bounty_refund';--> statement-breakpoint
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_reason_amount_bounty_check";--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reason_amount_bounty_check" CHECK (
    (
      "ledger_entries"."reason" IN ('initial_grant', 'daily_claim')
      AND "ledger_entries"."amount" > 0
      AND "ledger_entries"."bounty_id" IS NULL
    )
    OR
    (
      "ledger_entries"."reason"::text IN ('bounty_funding', 'bounty_fee')
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