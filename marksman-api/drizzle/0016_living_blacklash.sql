ALTER TABLE "hunt_attempts" ADD COLUMN "verification_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hunt_attempts" ADD COLUMN "next_verification_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hunt_attempts" ADD COLUMN "last_verification_error" text;