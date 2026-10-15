ALTER TABLE "bounties" ALTER COLUMN "creator_osu_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "completion_score_id" bigint;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "completed_at" timestamp with time zone;