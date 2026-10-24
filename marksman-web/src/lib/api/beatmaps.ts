import { osuBeatmapMetadataSchema } from "@marksman/contracts";
import { apiFetch } from "./client";

export async function getBeatmap(beatmapId: string) {
  return osuBeatmapMetadataSchema.parse(
    await apiFetch(`/beatmaps/${encodeURIComponent(beatmapId)}`, {
      method: "GET",
    }),
  );
}
