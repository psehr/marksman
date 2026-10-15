CREATE TYPE "public"."bounty_status" AS ENUM('draft', 'open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bounties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "bounty_status" NOT NULL,
	"reward_bp" integer NOT NULL,
	"goal" jsonb NOT NULL,
	"creator_osu_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bounties_reward_bp_positive" CHECK ("bounties"."reward_bp" > 0)
);
