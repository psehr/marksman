ALTER TYPE "public"."bounty_hunt_session_status" RENAME TO "bounty_hunt_status";--> statement-breakpoint
ALTER TABLE "bounty_hunt_sessions" RENAME TO "bounty_hunts";--> statement-breakpoint
ALTER TABLE "bounty_hunts" RENAME CONSTRAINT "bounty_hunt_sessions_pkey" TO "bounty_hunts_pkey";--> statement-breakpoint
ALTER TABLE "bounty_hunts" RENAME CONSTRAINT "bounty_hunt_sessions_user_id_users_id_fk" TO "bounty_hunts_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "bounty_hunts" RENAME CONSTRAINT "bounty_hunt_sessions_bounty_id_bounties_id_fk" TO "bounty_hunts_bounty_id_bounties_id_fk";--> statement-breakpoint
ALTER TABLE "bounty_hunts" RENAME CONSTRAINT "bounty_hunt_sessions_end_after_start" TO "bounty_hunts_end_after_start";--> statement-breakpoint
ALTER TABLE "bounty_hunts" RENAME CONSTRAINT "bounty_hunt_sessions_valid_ended_at" TO "bounty_hunts_valid_ended_at";--> statement-breakpoint
ALTER INDEX "bounty_hunt_sessions_one_ongoing_per_user_bounty" RENAME TO "bounty_hunts_one_ongoing_per_user_bounty";--> statement-breakpoint
ALTER INDEX "bounty_hunt_sessions_ongoing_hunts" RENAME TO "bounty_hunts_ongoing_hunts";
