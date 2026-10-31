import { z } from "zod";

export const bountyBeatmapMetadataSchema = z.object({
  url: z.url(),
  version: z.object({
    id: z.number().int(),
    name: z.string().min(1),
  }),
  song: z
    .object({
      title: z.string().min(1),
      artist: z.string().min(1),
    })
    .nullable(),
  specs: z.object({
    sr: z.number(),
    ar: z.number(),
    od: z.number(),
    cs: z.number(),
    hp: z.number(),
    bpm: z.number().nullable(),
    length: z.object({
      total: z.number(),
      drain: z.number(),
    }),
    maxCombo: z.number().int().positive(),
  }),
  covers: z
    .object({
      cover: z.url(),
      card: z.url(),
    })
    .nullable(),
  creator: z
    .object({
      id: z.number().int(),
      username: z.string().min(1),
    })
    .nullable(),
  stats: z.object({
    status: z.enum([
      "graveyard",
      "wip",
      "pending",
      "ranked",
      "approved",
      "qualified",
      "loved",
    ]),
    playcount: z.number().int().nonnegative(),
  }),
});

export const beatmapSchema = z.object({
  beatmapId: z.number().int().positive(),
  metadata: bountyBeatmapMetadataSchema,
  updatedAt: z.iso.datetime(),
});

export const osuBeatmapMetadataSchema = z.object({
  version: z.string().min(1),
  difficulty_rating: z.number(),
  mode: z.enum(["osu", "mania", "fruits", "taiko"]),
  status: z.enum([
    "graveyard",
    "wip",
    "pending",
    "ranked",
    "approved",
    "qualified",
    "loved",
  ]),
  bpm: z.number().nullable(),
  url: z.url(),
  max_combo: z.number().int().positive(),
  beatmapset: z
    .object({
      title: z.string().min(1),
      artist: z.string().min(1),
      creator: z.string().min(1),
      user_id: z.number().int(),
      covers: z.object({
        cover: z.url(),
        card: z.url(),
      }),
    })
    .nullable(),
  checksum: z
    .string()
    .regex(/^[a-f0-9]{32}$/i)
    .nullable(),
  id: z.number().int(),
  ar: z.number(),
  accuracy: z.number(),
  cs: z.number(),
  drain: z.number(),
  total_length: z.number().int().nonnegative(),
  hit_length: z.number().int().nonnegative(),
  playcount: z.number().int().nonnegative(),
});

export type OsuBeatmapMetadata = z.infer<typeof osuBeatmapMetadataSchema>;
export type BountyBeatmapMetadata = z.infer<typeof bountyBeatmapMetadataSchema>;
export type Beatmap = z.infer<typeof beatmapSchema>;

export function osuBeatmapMetadatatoBountyBeatmapMetadata(
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
