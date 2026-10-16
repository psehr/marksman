import { HuntAttemptScoreEvidence } from "@marksman/contracts";
import { findHuntsForScore } from "../db/bounty-hunts";
import { db } from "../db";
import { insertHuntAttempt } from "../db/bounty-hunts-attempts";

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
