import { z } from "zod";
import { bountyModFilterSchema, modRequirementSchema } from "./mods";
import { bountyBeatmapMetadataSchema } from "./beatmap";
import { userIdentitySchema } from "./user";
import { osuGradeSchema, scoreResponseSchema } from "./score";
import { bountyTierSchema } from "./bounty-tiers";

const baseGoalSchema = z.object({
  beatmapId: z.number().int().positive(),
  beatmapChecksum: z
    .string()
    .regex(/^[a-f0-9]{32}$/i)
    .nullable()
    .default(null),
  modRequirement: modRequirementSchema.default({ rule: "any" }),
  minimumAccuracy: z.number().min(0).max(100).optional(),
});

const bountyGoalSchema = z.discriminatedUnion("type", [
  // A bounty goal is defined by exclusively one of the following bounty types
  // The "full combo" type is used to require an FC for completion (with a minimum combo threshold ratio)
  // The "minimum_grade" type can be used to require clearing the map (minimum grade of "D"), or simply requiring a minimum grade for completion
  //
  // Additionally, a bounty goal has the following requirements:
  // - A beatmap id that corresponds to a specific difficulty/version of an osu! beatmap
  // - A mod requirement rule that describes if mods are to be used or not, and in which conditions
  //   (the default requirement rule is "any", which means any mod combination will be accepted for bounty completion)
  // - A minimum accuracy that must be achieved for bounty completion (optional)

  baseGoalSchema.extend({
    type: z.literal("full_combo"),
    // minimumComboRatio represents the minimum combo to maxCombo ratio that needs to be achieved for the score to be considered an FC
    // It is strictly positive and defaults to 0.99
    // For example a ratio of 0.99 of a 2,000 combo beatmap means that over 1,980 combo is considered to be a valid FC
    // A ratio of 1 means the achieved combo needs to be perfect, without any sliderend dropped
    minimumComboRatio: z.number().gt(0).max(1).default(0.99).optional(),
  }),

  baseGoalSchema.extend({
    type: z.literal("minimum_grade"),
    minimumGradeRequirement: osuGradeSchema.exclude(["F"]),
  }),
]);

export const bountySchema = z.object({
  id: z.uuid(),

  // "draft" bounties shouldn't be displayed to the users and represent an ongoing bounty creation process that can be paused/resumed
  // "open" bounties are currently up for completion by the users
  // "completed" bounties have been completed, the winner has been awarded for completion and the bounty cannot be claimed anymore
  // "cancelled" bounties have been cancelled by the bounty creator, and as such are not publicly displayed anymore
  status: z.enum(["draft", "open", "completed", "cancelled"]),

  // the BP (Bounty Points) reward that will be awarded to the user that successfully claims the bounty
  rewardBp: z.number().int().positive(),

  // the goal requirements for the bounty completion to be valid
  goal: bountyGoalSchema,
  creatorOsuUserId: z.number().int().positive(),
  completedByOsuUserId: z.number().int().positive().nullable(),
  completionScoreId: z.number().int().positive().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
});

export const createBountySchema = bountySchema.pick({
  // the user only has to supply the following fields when creating a bounty, the rest will be implied serverside
  rewardBp: true,
  goal: true,
});

export const bountyEngagementSchema = z.object({
  bookmarkCount: z.number().int().nonnegative(),
  isBookmarkedByCurrentUser: z.boolean().nullable(),
});

/**
 * A bounty enriched with related data for API responses.
 * Extends the stored bounty with beatmap metadata and, eventually,
 * other information needed by the frontend.
 *
 * A null beatmap means its metadata is unavailable.
 */
export const extendedBountySchema = bountySchema.extend({
  beatmap: bountyBeatmapMetadataSchema.nullable(),
  owner: userIdentitySchema.nullable(),
  winner: userIdentitySchema.nullable(),
  engagement: bountyEngagementSchema,
});

export const bountyCompletionRequestSchema = z.object({
  scoreId: z.number().int().positive(),
});

export const bountyCompletionValiditySchema = z.object({
  bountyIsClaimable: z.boolean(),
  playerIsClaimant: z.boolean(),
  playerIsNotOwner: z.boolean(),
  beatmapIsCorrect: z.boolean(),
  rulesetIsCorrect: z.boolean(),
  scoreIsSetAfterCreation: z.boolean(),
  scoreIsPassed: z.boolean(),
  modsAreCorrect: z.boolean(),
  scoreAccuracyIsSatisfied: z.boolean().optional(),
  gradeIsSatisfied: z.boolean().optional(),
  fcIsSatisfied: z.boolean().optional(),
});

export const bountyScoreCandidateSchema = scoreResponseSchema.extend({
  validity: bountyCompletionValiditySchema,
});

const bountyTypeEnum = z.enum(["full_combo", "minimum_grade"]);

export const bountySearchQuerySchema = z.object({
  status: z.enum(["open", "completed"]).default("open"),
  goals: z
    .string()
    .default("")
    .transform((value) => (value === "" ? [] : value.split(",")))
    .pipe(z.array(bountyTypeEnum)),
  tiers: z
    .string()
    .default("")
    .transform((value) => (value === "" ? [] : value.split(",")))
    .pipe(z.array(bountyTierSchema)),
  mods: z
    .string()
    .default("")
    .transform((value) => (value === "" ? [] : value.split(",")))
    .pipe(z.array(bountyModFilterSchema))
    .transform((mods) =>
      mods.includes("NM") ? ["NM" as const] : [...new Set(mods)],
    ),
  search: z.string().trim().default(""),
  sort: z.enum(["date", "reward"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  relationship: z.enum(["all", "created", "bookmarked"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
});

export const bountyListResponseSchema = z.object({
  items: z.array(extendedBountySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type Bounty = z.infer<typeof bountySchema>;
export type CreateBountyInput = z.infer<typeof createBountySchema>;
export type ExtendedBounty = z.infer<typeof extendedBountySchema>;
export type BountyCompletionValidity = z.infer<
  typeof bountyCompletionValiditySchema
>;
export type BountyScoreCandidate = z.infer<typeof bountyScoreCandidateSchema>;
export type BountyEngagement = z.infer<typeof bountyEngagementSchema>;
export type BountySearchQuery = z.infer<typeof bountySearchQuerySchema>;
export type BountyListResponse = z.infer<typeof bountyListResponseSchema>;
