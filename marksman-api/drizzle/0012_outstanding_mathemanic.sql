CREATE TYPE "public"."bounty_hunt_session_status" AS ENUM('ongoing', 'expired', 'pending', 'completed', 'failed', 'abandoned', 'closed');--> statement-breakpoint
CREATE TABLE "bounty_hunt_progress" (
	"user_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"strikes" integer DEFAULT 0 NOT NULL,
	"cooldown_until" timestamp with time zone,
	CONSTRAINT "bounty_hunt_progress_user_id_bounty_id_pk" PRIMARY KEY("user_id","bounty_id"),
	CONSTRAINT "bounty_hunt_progress_strikes_range" CHECK ("bounty_hunt_progress"."strikes" BETWEEN 0 AND 3)
);
--> statement-breakpoint
CREATE TABLE "bounty_hunt_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"status" "bounty_hunt_session_status" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "bounty_hunt_sessions_expiry_after_start" CHECK ("bounty_hunt_sessions"."expires_at" > "bounty_hunt_sessions"."started_at")
);
--> statement-breakpoint
ALTER TABLE "bounty_hunt_progress" ADD CONSTRAINT "bounty_hunt_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_hunt_progress" ADD CONSTRAINT "bounty_hunt_progress_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" ADD CONSTRAINT "bounty_hunt_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" ADD CONSTRAINT "bounty_hunt_sessions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bounty_hunt_sessions_one_ongoing_per_user" ON "bounty_hunt_sessions" USING btree ("user_id") WHERE "bounty_hunt_sessions"."status" = 'ongoing';--> statement-breakpoint
CREATE UNIQUE INDEX "bounty_hunt_sessions_one_unresolved_per_user_bounty" ON "bounty_hunt_sessions" USING btree ("user_id","bounty_id") WHERE "bounty_hunt_sessions"."status" IN ('ongoing', 'expired', 'pending');--> statement-breakpoint
CREATE INDEX "bounty_hunt_sessions_ongoing_expiry" ON "bounty_hunt_sessions" USING btree ("expires_at") WHERE "bounty_hunt_sessions"."status" = 'ongoing';