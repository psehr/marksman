ALTER TABLE "bounty_hunters" RENAME TO "bounty_bookmarks";--> statement-breakpoint
ALTER TABLE "bounty_bookmarks" DROP CONSTRAINT "bounty_hunters_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bounty_bookmarks" DROP CONSTRAINT "bounty_hunters_bounty_id_bounties_id_fk";
--> statement-breakpoint
DROP INDEX "bounty_hunters_bounty_id_idx";--> statement-breakpoint
ALTER TABLE "bounty_bookmarks" DROP CONSTRAINT "bounty_hunters_user_id_bounty_id_pk";--> statement-breakpoint
ALTER TABLE "bounty_bookmarks" ADD CONSTRAINT "bounty_bookmarks_user_id_bounty_id_pk" PRIMARY KEY("user_id","bounty_id");--> statement-breakpoint
ALTER TABLE "bounty_bookmarks" ADD CONSTRAINT "bounty_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_bookmarks" ADD CONSTRAINT "bounty_bookmarks_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bounty_bookmarks_bounty_id_idx" ON "bounty_bookmarks" USING btree ("bounty_id");