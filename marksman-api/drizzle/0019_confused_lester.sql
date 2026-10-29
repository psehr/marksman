CREATE TABLE "bounty_beatmaps" (
	"beatmap_id" integer PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
