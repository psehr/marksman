import {
  BeatmapSearchRequest,
  beatmapSearchRequestSchema,
  BeatmapSearchResponse,
  beatmapSearchResponseSchema,
  osuBeatmapMetadataSchema,
} from "@marksman/contracts";
import { apiFetch } from "./client";

export async function getBeatmap(beatmapId: string) {
  return osuBeatmapMetadataSchema.parse(
    await apiFetch(`/beatmaps/${encodeURIComponent(beatmapId)}`, {
      method: "GET",
    }),
  );
}

export async function searchBeatmaps(
  input: BeatmapSearchRequest,
  signal?: AbortSignal,
): Promise<BeatmapSearchResponse> {
  const parsedInput = beatmapSearchRequestSchema.parse(input);

  const params = new URLSearchParams({
    query: parsedInput.query,
  });

  if (parsedInput.cursor) {
    params.set("cursor", parsedInput.cursor);
  }

  return beatmapSearchResponseSchema.parse(
    await apiFetch(`/beatmaps/search?${params.toString()}`, {
      method: "GET",
      signal,
    }),
  );
}
