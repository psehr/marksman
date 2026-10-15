ALTER TABLE "bounties" ALTER COLUMN "creator_osu_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "completed_by_osu_user_id" integer;