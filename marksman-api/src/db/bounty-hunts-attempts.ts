import { HuntAttemptScoreEvidence } from "@marksman/contracts";
import { Transaction } from ".";
import { huntAttempts } from "./schema";

export async function insertHuntAttempt(
  connection: Transaction,
  huntId: string,
  scoreEvidence: HuntAttemptScoreEvidence,
  now: Date,
) {
  await connection
    .insert(huntAttempts)
    .values({
      huntId,
      scoreId: scoreEvidence.id,
      scoreEndedAt: new Date(scoreEvidence.ended_at),
      discoveredAt: now,
      scoreEvidence,
      verificationStatus: "pending",
      verificationResult: null,
      verifiedAt: null,
    })
    .onConflictDoNothing({
      target: [huntAttempts.huntId, huntAttempts.scoreId],
    });
}
