import { z } from "zod";
import { bountyCompletionValiditySchema } from "./bounty";
import { scoreResponseSchema } from "./score";

// temporary shape picking
export const huntAttemptVerificationResultSchema =
  bountyCompletionValiditySchema
    .omit({ bountyIsClaimable: true, scoreIsSetAfterCreation: true })
    .extend({
      scoreIsWithinHuntPeriod: z.boolean(),
    });

export const huntAttemptScoreEvidenceSchema = scoreResponseSchema.pick({
  id: true,
  ended_at: true,
  user_id: true,
  beatmap_id: true,
  ruleset_id: true,
  passed: true,
  accuracy: true,
  mods: true,
  rank: true,
  legacy_score_id: true,
  max_combo: true,
  statistics: true,
});

export const huntAttemptStatusEnum = z.enum(["pending", "valid", "invalid"]);
export const huntAttemptSchema = z.object({
  id: z.uuid(),
  huntId: z.uuid(),
  scoreId: z.number().int().positive(),
  scoreEndedAt: z.iso.datetime(),
  discoveredAt: z.iso.datetime(),
  scoreEvidence: huntAttemptScoreEvidenceSchema,
  verificationStatus: huntAttemptStatusEnum,
  verificationResult: huntAttemptVerificationResultSchema.nullable(),
  verifiedAt: z.iso.datetime().nullable(),
  verificationAttempts: z.number().int().nonnegative(),
  nextVerificationAt: z.iso.datetime().nullable(),
  lastVerificationError: z.string().nullable(),
});

export type HuntAttempt = z.infer<typeof huntAttemptSchema>;
export type HuntAttemptVerificationResult = z.infer<
  typeof huntAttemptVerificationResultSchema
>;
export type HuntAttemptScoreEvidence = z.infer<
  typeof huntAttemptScoreEvidenceSchema
>;
export type HuntAttemptStatus = z.infer<typeof huntAttemptStatusEnum>;
