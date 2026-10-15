import { z } from "zod";
import { osuModSchema } from "./mods";
import { osuBeatmapMetadataSchema } from "./beatmap";

export const osuGradeSchema = z.enum([
  "F",
  "D",
  "C",
  "B",
  "A",
  "S",
  "SH",
  "X",
  "XH",
]);

export const scoreResponseSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  beatmap_id: z.number().int().positive(),
  ruleset_id: z.number().int().min(0).max(3),
  legacy_score_id: z.number().int().positive().nullable().optional(),
  ended_at: z.iso.datetime({ offset: true }),
  accuracy: z.number().min(0).max(1),
  mods: z.array(osuModSchema),
  rank: osuGradeSchema,
  max_combo: z.number().int().min(0),
  statistics: z.object({
    miss: z.number().int().min(0).optional(),
    large_tick_miss: z.number().int().min(0).optional(),
    combo_break: z.number().int().min(0).optional(),
  }),
  passed: z.boolean(),
  beatmap: osuBeatmapMetadataSchema
    .pick({
      version: true,
      difficulty_rating: true,
    })
    .extend({
      max_combo: osuBeatmapMetadataSchema.shape.max_combo.optional(),
    }),
  beatmapset: osuBeatmapMetadataSchema.shape.beatmapset,
});

export type ScoreResponse = z.infer<typeof scoreResponseSchema>;
export type OsuGrade = z.infer<typeof osuGradeSchema>;
