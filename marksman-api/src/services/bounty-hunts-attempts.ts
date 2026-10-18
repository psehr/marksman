import {
  HuntAttempt,
  HuntAttemptScoreEvidence,
  OsuBeatmapMetadata,
} from "@marksman/contracts";
import {
  findHuntById,
  findHuntPlayerBeatmapPairs,
  findHuntsForScore,
} from "../db/bounty-hunts";
import { db } from "../db";
import {
  findDueHuntAttempts,
  findHuntAttemptById,
  insertHuntAttempt,
  saveHuntAttemptVerification,
  scheduleHuntAttemptRetry,
} from "../db/bounty-hunts-attempts";
import {
  checkHuntAttemptValidity,
  evaluateHuntAttempt,
} from "./bounty-verification";
import { findBountyById } from "../db/bounties";
import { findUserById } from "../db/users";
import { getBeatmap } from "../integrations/osu/beatmaps";
import {
  BeatmapNotFoundError,
  BountyNotFoundError,
  HuntAttemptNotFoundError,
  HuntNotFoundError,
  InvalidBeatmapMetadataError,
  OsuApiError,
  UserNotFoundError,
} from "./errors";

export async function recordDiscoveredScore(
  scoreEvidence: HuntAttemptScoreEvidence,
) {
  return db.transaction(async (tx) => {
    const hunts = await findHuntsForScore(
      tx,
      scoreEvidence.user_id,
      scoreEvidence.beatmap_id,
      new Date(scoreEvidence.ended_at),
    );

    const now = new Date();

    for (const hunt of hunts) {
      await insertHuntAttempt(tx, hunt.id, scoreEvidence, now);
    }
  });
}

function calcRetryDelay(now: Date, attemptNumber: number): Date {
  if (attemptNumber === 0) {
    // 5 seconds
    const DELAY = 5 * 1000;
    return new Date(now.getTime() + DELAY);
  } else if (attemptNumber === 1) {
    // 15 seconds
    const DELAY = 15 * 1000;
    return new Date(now.getTime() + DELAY);
  } else if (attemptNumber === 2) {
    // 1 minute
    const DELAY = 60 * 1000;
    return new Date(now.getTime() + DELAY);
  } else {
    // 5 minutes
    const DELAY = 5 * 60 * 1000;
    return new Date(now.getTime() + DELAY);
  }
}

function getVerificationErrorCode(error: unknown): string {
  if (error instanceof OsuApiError) return "OSU_API_ERROR";
  if (error instanceof InvalidBeatmapMetadataError)
    return "INVALID_BEATMAP_METADATA_ERROR";
  if (error instanceof BeatmapNotFoundError) return "BEATMAP_NOT_FOUND";
  if (error instanceof HuntNotFoundError) return "HUNT_NOT_FOUND";
  if (error instanceof BountyNotFoundError) return "BOUNTY_NOT_FOUND";
  if (error instanceof UserNotFoundError) return "USER_NOT_FOUND";
  return "UNEXPECTED_ERROR";
}

export async function verifyHuntAttempt(
  attemptId: string,
): Promise<HuntAttempt | undefined> {
  // default 5 min retry delay for unexpected errors in the verification, only osu! API related errors schedule increasingly
  const DEFAULT_RETRY_DELAY_MS = 5 * 60 * 1000;

  const attempt = await findHuntAttemptById(db, attemptId);
  if (!attempt) throw new HuntAttemptNotFoundError();

  if (attempt.verificationStatus !== "pending") return attempt;

  try {
    const hunt = await findHuntById(db, attempt.huntId);
    if (!hunt) throw new HuntNotFoundError();

    const bounty = await findBountyById(db, hunt.bountyId);
    if (!bounty) throw new BountyNotFoundError();

    const user = await findUserById(hunt.userId);
    if (!user) throw new UserNotFoundError();
    const identity = user.identity;

    const clientType = attempt.scoreEvidence.legacy_score_id
      ? "stable"
      : "lazer";
    let beatmap: OsuBeatmapMetadata | undefined;
    if (clientType === "stable" && bounty.goal.type === "full_combo") {
      beatmap = await getBeatmap(bounty.goal.beatmapId);
    }

    return await db.transaction(async (tx) => {
      const now = new Date();

      const verificationResult = evaluateHuntAttempt(
        attempt.scoreEvidence,
        bounty,
        identity,
        new Date(hunt.startedAt),
        hunt.endedAt ? new Date(hunt.endedAt) : null,
        beatmap?.max_combo,
      );

      const validity = checkHuntAttemptValidity(verificationResult);

      const verifiedAttempt = await saveHuntAttemptVerification(
        tx,
        attemptId,
        verificationResult,
        validity,
        now,
      );

      return verifiedAttempt;
    });
  } catch (error) {
    const now = new Date();
    const usesBackoff =
      error instanceof OsuApiError ||
      error instanceof InvalidBeatmapMetadataError;
    const nextRetry = usesBackoff
      ? calcRetryDelay(now, attempt.verificationAttempts)
      : new Date(now.getTime() + DEFAULT_RETRY_DELAY_MS);

    await scheduleHuntAttemptRetry(
      db,
      attemptId,
      getVerificationErrorCode(error),
      nextRetry,
    );
    throw error;
  }
}

export async function verifyDueHuntAttempts(limit: number) {
  const dueAttempts = await findDueHuntAttempts(db, new Date(), limit);

  const failuresArray: { attemptId: string; error: unknown }[] = [];

  for (const attempt of dueAttempts) {
    try {
      await verifyHuntAttempt(attempt.id);
    } catch (error) {
      failuresArray.push({ attemptId: attempt.id, error });
    }
  }

  return failuresArray;
}

export async function filterScoresForHunts(
  scores: HuntAttemptScoreEvidence[],
): Promise<HuntAttemptScoreEvidence[]> {
  // deduplicating inputs
  const osuUserIds = [...new Set(scores.map((score) => score.user_id))];
  const beatmapIds = [...new Set(scores.map((score) => score.beatmap_id))];

  const filteredPairs = await findHuntPlayerBeatmapPairs(
    db,
    osuUserIds,
    beatmapIds,
  );

  const pairKeys = new Set(
    filteredPairs.map((pair) => `${pair.osuUserId}:${pair.beatmapId}`),
  );

  return scores.filter((score) => {
    return pairKeys.has(`${score.user_id}:${score.beatmap_id}`);
  });
}
