CREATE TABLE "bounty_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bounty_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_bp" integer NOT NULL,
	"fee_bp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bounty_contributions_bp_amount_positive" CHECK ("bounty_contributions"."amount_bp" > 0),
	CONSTRAINT "bounty_contributions_nonnegative_fee" CHECK ("bounty_contributions"."fee_bp" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bounty_contributions" ADD CONSTRAINT "bounty_contributions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_contributions" ADD CONSTRAINT "bounty_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bounty_contributions_bounty_id_idx" ON "bounty_contributions" USING btree ("bounty_id");