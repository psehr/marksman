CREATE TABLE "bounty_hunters" (
	"user_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bounty_hunters_user_id_bounty_id_pk" PRIMARY KEY("user_id","bounty_id")
);
--> statement-breakpoint
ALTER TABLE "bounty_hunters" ADD CONSTRAINT "bounty_hunters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_hunters" ADD CONSTRAINT "bounty_hunters_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bounty_hunters_bounty_id_idx" ON "bounty_hunters" USING btree ("bounty_id");