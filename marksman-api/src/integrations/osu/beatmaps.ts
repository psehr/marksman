import {
  OsuBeatmapMetadata,
  osuBeatmapMetadataSchema,
} from "@marksman/contracts";
import { getOsuAccessToken } from "./auth";
import { BeatmapNotFoundError, OsuApiError } from "../../services/errors";

let cachedBeatmapsMetadata: Map<
  number,
  { metadata: OsuBeatmapMetadata; expiresAt: number }
> = new Map();
let cachedBeatmapsMetadataRequests: Map<
  number,
  { request: Promise<OsuBeatmapMetadata> }
> = new Map();

export async function requestBeatmap(beatmapId: number) {
  const requestStartedAt = Date.now();

  try {
    const token = await getOsuAccessToken();
    const response = await fetch(
      `https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (response.status === 404) {
      throw new BeatmapNotFoundError();
    }

    if (!response.ok) {
      throw new Error("Beatmap request rejected");
    }

    const beatmapMetadata = osuBeatmapMetadataSchema.parse(
      await response.json(),
    );

    cleanupExpiredCachedBeatmapMetadata();

    if (
      !cachedBeatmapsMetadata.has(beatmapId) &&
      cachedBeatmapsMetadata.size >= 500
    ) {
      evictEarliestExpiringBeatmap();
    }

    cachedBeatmapsMetadata.set(beatmapId, {
      metadata: beatmapMetadata,
      expiresAt: requestStartedAt + 10 * 60 * 1000,
    });

    return beatmapMetadata;
  } catch (error) {
    if (error instanceof BeatmapNotFoundError) throw error;
    throw new OsuApiError();
  }
}

export async function getBeatmap(beatmapId: number) {
  const now = Date.now();
  const cachedBeatmap = cachedBeatmapsMetadata.get(beatmapId);
  const cachedRequest = cachedBeatmapsMetadataRequests.get(beatmapId);

  if (cachedBeatmap && now < cachedBeatmap.expiresAt) {
    return cachedBeatmap.metadata;
  }

  if (cachedRequest) {
    return cachedRequest.request;
  }

  const request = requestBeatmap(beatmapId).finally(() => {
    cachedBeatmapsMetadataRequests.delete(beatmapId);
  });

  cachedBeatmapsMetadataRequests.set(beatmapId, { request });

  return request;
}

function cleanupExpiredCachedBeatmapMetadata() {
  const now = Date.now();

  for (const [beatmapId, entry] of cachedBeatmapsMetadata) {
    if (entry.expiresAt <= now) cachedBeatmapsMetadata.delete(beatmapId);
  }
}

function evictEarliestExpiringBeatmap() {
  let currDeletionCandidate;

  for (const [beatmapId, entry] of cachedBeatmapsMetadata) {
    if (!currDeletionCandidate) currDeletionCandidate = { beatmapId, entry };
    if (entry.expiresAt < currDeletionCandidate.entry.expiresAt)
      currDeletionCandidate = { beatmapId, entry };
  }

  if (currDeletionCandidate) {
    cachedBeatmapsMetadata.delete(currDeletionCandidate.beatmapId);
  }
}
