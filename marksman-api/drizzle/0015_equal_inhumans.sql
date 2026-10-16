CREATE TYPE "public"."verification_status_enum" AS ENUM('pending', 'valid', 'invalid');--> statement-breakpoint
CREATE TABLE "hunt_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hunt_id" uuid NOT NULL,
	"score_id" bigint NOT NULL,
	"score_ended_at" timestamp with time zone NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL,
	"score_evidence" jsonb NOT NULL,
	"verification_status" "verification_status_enum" NOT NULL,
	"verification_result" jsonb,
	"verified_at" timestamp with time zone,
	CONSTRAINT "hunt_attempts_hunt_id_score_id_unique" UNIQUE("hunt_id","score_id"),
	CONSTRAINT "hunt_attempts_verification_state_check" CHECK (
      ("hunt_attempts"."verification_status" = 'pending' AND "hunt_attempts"."verification_result" IS NULL AND "hunt_attempts"."verified_at" IS NULL)
      OR
      ("hunt_attempts"."verification_status" IN ('valid', 'invalid') AND "hunt_attempts"."verification_result" IS NOT NULL AND "hunt_attempts"."verified_at" IS NOT NULL)
      )
);
--> statement-breakpoint
ALTER TABLE "hunt_attempts" ADD CONSTRAINT "hunt_attempts_hunt_id_bounty_hunts_id_fk" FOREIGN KEY ("hunt_id") REFERENCES "public"."bounty_hunts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
