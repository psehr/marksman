CREATE TABLE "bounty_settlements" (
	"bounty_id" uuid PRIMARY KEY NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"settle_after" timestamp with time zone NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bounty_settlements" ADD CONSTRAINT "bounty_settlements_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;