import {
  HuntAttempt,
  HuntAttemptScoreEvidence,
  HuntAttemptStatus,
  HuntAttemptVerificationResult,
} from "@marksman/contracts";
import { db, Transaction } from ".";
import { bountyHunts, huntAttempts } from "./schema";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

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
    verificationAttempts: row.verificationAttempts,
    nextVerificationAt: row.nextVerificationAt
      ? row.nextVerificationAt.toISOString()
      : null,
    lastVerificationError: row.lastVerificationError,
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
      verificationAttempts: 0,
      nextVerificationAt: now,
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
      verificationAttempts: sql`${huntAttempts.verificationAttempts} + 1`,
      nextVerificationAt: null,
      lastVerificationError: null,
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

export async function scheduleHuntAttemptRetry(
  connection: Transaction | typeof db,
  attemptId: string,
  errorCode: string,
  nextRetry: Date,
) {
  const [row] = await connection
    .update(huntAttempts)
    .set({
      verificationAttempts: sql`${huntAttempts.verificationAttempts} + 1`,
      nextVerificationAt: nextRetry,
      lastVerificationError: errorCode,
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

export async function findDueHuntAttempts(
  connection: Transaction | typeof db,
  now: Date,
  limit: number,
): Promise<HuntAttempt[]> {
  const rows = await connection
    .select()
    .from(huntAttempts)
    .where(
      and(
        eq(huntAttempts.verificationStatus, "pending"),
        lte(huntAttempts.nextVerificationAt, now),
      ),
    )
    .orderBy(asc(huntAttempts.nextVerificationAt), asc(huntAttempts.id))
    .limit(limit);

  return rows.map((row) => {
    return toHuntAttempt(row);
  });
}

export async function findLeadingHuntAttempt(
  connection: Transaction | typeof db,
  bountyId: string,
) {
  const [row] = await connection
    .select({ huntAttempts })
    .from(huntAttempts)
    .innerJoin(bountyHunts, eq(bountyHunts.id, huntAttempts.huntId))
    .where(
      and(
        inArray(huntAttempts.verificationStatus, ["valid", "pending"]),
        eq(bountyHunts.bountyId, bountyId),
      ),
    )
    .orderBy(asc(huntAttempts.scoreEndedAt), asc(huntAttempts.scoreId))
    .limit(1);

  return row ? toHuntAttempt(row.huntAttempts) : undefined;
}
