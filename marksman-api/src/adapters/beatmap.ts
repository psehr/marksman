import { BountyBeatmapMetadata, OsuBeatmapMetadata } from "@marksman/contracts";

export function toBountyBeatmapMetadata(
  osuBeatmapMetadata: OsuBeatmapMetadata,
): BountyBeatmapMetadata {
  return {
    url: osuBeatmapMetadata.url,
    version: {
      id: osuBeatmapMetadata.id,
      name: osuBeatmapMetadata.version,
    },
    song: osuBeatmapMetadata.beatmapset
      ? {
          title: osuBeatmapMetadata.beatmapset.title,
          artist: osuBeatmapMetadata.beatmapset.artist,
        }
      : null,
    specs: {
      sr: osuBeatmapMetadata.difficulty_rating,
      ar: osuBeatmapMetadata.ar,
      od: osuBeatmapMetadata.accuracy,
      cs: osuBeatmapMetadata.cs,
      hp: osuBeatmapMetadata.drain,
      bpm: osuBeatmapMetadata.bpm,
      length: {
        total: osuBeatmapMetadata.total_length,
        drain: osuBeatmapMetadata.hit_length,
      },
      maxCombo: osuBeatmapMetadata.max_combo,
    },
    covers: osuBeatmapMetadata.beatmapset
      ? {
          cover: osuBeatmapMetadata.beatmapset.covers.cover,
          card: osuBeatmapMetadata.beatmapset.covers.card,
        }
      : null,
    creator: osuBeatmapMetadata.beatmapset
      ? {
          id: osuBeatmapMetadata.beatmapset.user_id,
          username: osuBeatmapMetadata.beatmapset.creator,
        }
      : null,
    stats: {
      status: osuBeatmapMetadata.status,
      playcount: osuBeatmapMetadata.playcount,
    },
  };
}
