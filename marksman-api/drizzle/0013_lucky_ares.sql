DROP INDEX "bounty_hunt_sessions_one_ongoing_per_user";--> statement-breakpoint
DROP INDEX "bounty_hunt_sessions_one_unresolved_per_user_bounty";--> statement-breakpoint
DROP INDEX "bounty_hunt_sessions_ongoing_expiry";--> statement-breakpoint
ALTER TABLE "bounty_hunt_progress" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "bounty_hunt_progress" CASCADE;--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" DROP CONSTRAINT "bounty_hunt_sessions_expiry_after_start";--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" ALTER COLUMN "status" TYPE text USING "status"::text;--> statement-breakpoint
DROP TYPE "public"."bounty_hunt_session_status";--> statement-breakpoint
CREATE TYPE "public"."bounty_hunt_session_status" AS ENUM('ongoing', 'stopped', 'closed');--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" ALTER COLUMN "status" TYPE "public"."bounty_hunt_session_status" USING "status"::"public"."bounty_hunt_session_status";--> statement-breakpoint
CREATE UNIQUE INDEX "bounty_hunt_sessions_one_ongoing_per_user_bounty" ON "bounty_hunt_sessions" USING btree ("user_id","bounty_id") WHERE "bounty_hunt_sessions"."status" = 'ongoing';--> statement-breakpoint
CREATE INDEX "bounty_hunt_sessions_ongoing_hunts" ON "bounty_hunt_sessions" USING btree ("user_id") WHERE "bounty_hunt_sessions"."status" = 'ongoing';--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" DROP COLUMN "resolved_at";--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" ADD CONSTRAINT "bounty_hunt_sessions_end_after_start" CHECK ("bounty_hunt_sessions"."ended_at" >= "bounty_hunt_sessions"."started_at");--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" ADD CONSTRAINT "bounty_hunt_sessions_valid_ended_at" CHECK (
      ("bounty_hunt_sessions"."status" = 'ongoing' AND "bounty_hunt_sessions"."ended_at" IS NULL) 
      OR 
      ("bounty_hunt_sessions"."status" IN ('stopped', 'closed') AND "bounty_hunt_sessions"."ended_at" IS NOT NULL)
      );
