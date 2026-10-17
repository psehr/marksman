import {
  HuntAttemptScoreEvidence,
  OsuBeatmapMetadata,
} from "@marksman/contracts";
import { findHuntById, findHuntsForScore } from "../db/bounty-hunts";
import { db } from "../db";
import {
  findHuntAttemptById,
  insertHuntAttempt,
  saveHuntAttemptVerification,
} from "../db/bounty-hunts-attempts";
import {
  checkHuntAttemptValidity,
  evaluateHuntAttempt,
} from "./bounty-verification";
import { findBountyById } from "../db/bounties";
import { findUserById } from "../db/users";
import { getBeatmap } from "../integrations/osu/beatmaps";
import {
  BountyNotFoundError,
  HuntAttemptNotFoundError,
  HuntNotFoundError,
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

export async function verifyHuntAttempt(attemptId: string) {
  const attempt = await findHuntAttemptById(db, attemptId);
  if (!attempt) throw new HuntAttemptNotFoundError();

  if (attempt.verificationStatus !== "pending") return attempt;

  const hunt = await findHuntById(db, attempt.huntId);
  if (!hunt) throw new HuntNotFoundError();

  const bounty = await findBountyById(db, hunt.bountyId);
  if (!bounty) throw new BountyNotFoundError();

  const user = await findUserById(hunt.userId);
  if (!user) throw new UserNotFoundError();
  const identity = user.identity;

  const clientType = attempt.scoreEvidence.legacy_score_id ? "stable" : "lazer";

  let beatmap: OsuBeatmapMetadata | undefined;
  if (clientType === "stable" && bounty.goal.type === "full_combo") {
    beatmap = await getBeatmap(bounty.goal.beatmapId);
  }

  return db.transaction(async (tx) => {
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
}
