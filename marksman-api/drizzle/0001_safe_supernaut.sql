CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"osu_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bp_balance" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "users_osu_user_id_unique" UNIQUE("osu_user_id"),
	CONSTRAINT "bp_balance" CHECK ("users"."bp_balance" >= 0)
);
