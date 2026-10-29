import {
  BountyBeatmapMetadata,
  bountyBeatmapMetadataSchema,
} from "@marksman/contracts";
import { db, Transaction } from ".";
import { bountyBeatmaps } from "./schema";

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
