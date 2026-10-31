import { asc, eq, isNull, sql } from "drizzle-orm";
import {
  bountyBeatmapMetadataSchema,
  osuBeatmapMetadatatoBountyBeatmapMetadata,
} from "@marksman/contracts";
import { db, pool } from "../db";
import { bounties, bountyBeatmaps } from "../db/schema";
import { getBeatmap } from "../integrations/osu/beatmaps";

/** Fill missing metadata only; reruns preserve already stored metadata. */
export async function backfillBeatmaps(
  connection: typeof db = db,
  fetchBeatmap: typeof getBeatmap = getBeatmap,
  report: (message: string) => void = console.log,
) {
  const beatmapId = sql<number>`(${bounties.goal}->>'beatmapId')::integer`;
  const missing = await connection
    .selectDistinct({ beatmapId })
    .from(bounties)
    .leftJoin(bountyBeatmaps, eq(bountyBeatmaps.beatmapId, beatmapId))
    .where(isNull(bountyBeatmaps.beatmapId))
    .orderBy(asc(beatmapId));

  const result = { saved: 0, skipped: 0, failedIds: [] as number[] };
  report(`Found ${missing.length} distinct beatmaps without stored metadata.`);

  // Sequential requests keep upstream concurrency bounded. Each success commits
  // independently, so an interrupted run can resume by running the command again.
  for (const { beatmapId: id } of missing) {
    try {
      const raw = await fetchBeatmap(id);
      if (raw.id !== id) throw new Error("Beatmap response ID mismatch");
      const metadata = bountyBeatmapMetadataSchema.parse(
        osuBeatmapMetadatatoBountyBeatmapMetadata(raw),
      );
      const saved = await connection
        .insert(bountyBeatmaps)
        .values({ beatmapId: id, metadata, updatedAt: new Date() })
        // Creation may have saved fresher metadata while this request was pending.
        .onConflictDoNothing({ target: bountyBeatmaps.beatmapId })
        .returning({ beatmapId: bountyBeatmaps.beatmapId });
      if (saved.length) {
        result.saved++;
        report(`Saved beatmap ${id}.`);
      } else {
        result.skipped++;
        report(`Skipped beatmap ${id}: metadata already stored.`);
      }
    } catch {
      result.failedIds.push(id);
      report(`Failed beatmap ${id}; rerun to retry.`);
    }
  }

  report(
    `Finished: ${result.saved} saved, ${result.skipped} skipped, ${result.failedIds.length} failed.`,
  );
  if (result.failedIds.length)
    report(`Failed IDs: ${result.failedIds.join(", ")}`);
  return result;
}

if (require.main === module) {
  (async () => {
    try {
      const result = await backfillBeatmaps();
      if (result.failedIds.length) process.exitCode = 1;
    } catch {
      console.error(
        "Backfill could not complete. Check database access, configuration and applied migrations.",
      );
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })().catch(() => {
    console.error("Backfill database shutdown failed.");
    process.exitCode = 1;
  });
}
