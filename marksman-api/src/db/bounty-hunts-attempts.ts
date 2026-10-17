import {
  HuntAttempt,
  HuntAttemptScoreEvidence,
  HuntAttemptStatus,
  HuntAttemptVerificationResult,
} from "@marksman/contracts";
import { db, Transaction } from ".";
import { huntAttempts } from "./schema";
import { and, eq } from "drizzle-orm";

function toHuntAttempt(row: typeof huntAttempts.$inferSelect): HuntAttempt {
  return {
    id: row.id,
    scoreId: row.scoreId,
    huntId: row.huntId,
    scoreEvidence: row.scoreEvidence,
    scoreEndedAt: row.scoreEndedAt.toISOString(),
    discoveredAt: row.discoveredAt.toISOString(),
    verificationStatus: row.verificationStatus,
    verificationResult: row.verificationResult,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  };
}

export async function findHuntAttemptById(
  connection: Transaction | typeof db,
  attemptId: string,
) {
  const [row] = await connection
    .select()
    .from(huntAttempts)
    .where(eq(huntAttempts.id, attemptId));

  return row ? toHuntAttempt(row) : undefined;
}

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

export async function saveHuntAttemptVerification(
  connection: Transaction,
  attemptId: string,
  verificationResult: HuntAttemptVerificationResult,
  verificationValidity: Exclude<HuntAttemptStatus, "pending">,
  now: Date,
): Promise<HuntAttempt | undefined> {
  const [row] = await connection
    .update(huntAttempts)
    .set({
      verificationResult,
      verificationStatus: verificationValidity,
      verifiedAt: now,
    })
    .where(
      and(
        eq(huntAttempts.id, attemptId),
        eq(huntAttempts.verificationStatus, "pending"),
      ),
    )
    .returning();

  return row ? toHuntAttempt(row) : undefined;
}
