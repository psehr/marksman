import {
  Beatmap,
  BountyBeatmapMetadata,
  bountyBeatmapMetadataSchema,
} from "@marksman/contracts";
import { db, Transaction } from ".";
import { bountyBeatmaps } from "./schema";
import { eq } from "drizzle-orm";

function toBeatmap(row: typeof bountyBeatmaps.$inferSelect): Beatmap {
  return {
    beatmapId: row.beatmapId,
    metadata: row.metadata,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertBountyBeatmap(
  connection: Transaction | typeof db,
  metadata: BountyBeatmapMetadata,
) {
  const now = new Date();

  const parsedMetadata = bountyBeatmapMetadataSchema.parse(metadata);

  const [row] = await connection
    .insert(bountyBeatmaps)
    .values({
      beatmapId: parsedMetadata.version.id,
      metadata: parsedMetadata,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: bountyBeatmaps.beatmapId,
      set: {
        metadata: parsedMetadata,
        updatedAt: now,
      },
    })
    .returning();

  return row;
}

export async function findBeatmapById(
  connection: Transaction | typeof db,
  beatmapId: number,
): Promise<Beatmap | undefined> {
  const [row] = await connection
    .select()
    .from(bountyBeatmaps)
    .where(eq(bountyBeatmaps.beatmapId, beatmapId));

  return row ? toBeatmap(row) : undefined;
}
