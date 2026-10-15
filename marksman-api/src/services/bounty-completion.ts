import { Bounty, UserIdentity } from "@marksman/contracts";
import { uuidSchema } from "../models/common";
import {
  findBountyById,
  findBountyByIdForUpdate,
  markOpenBountyCompleted,
} from "../db/bounties";

import {
  evaluateBountyCompletion,
  isBountyCompletionValid,
} from "./bounty-verification";
import { db } from "../db";
import { creditUserBp } from "../db/users";
import {
  BeatmapMetadataUnavailableError,
  BountyNotFoundError,
  BountyNotOpenError,
  PayoutRecipientNotFoundError,
} from "./errors";

import { fetchScore } from "../integrations/osu/scores";
import { getBeatmap } from "../integrations/osu/beatmaps";
import { createBountyRewardLedgerEntry } from "../db/ledger";
import { closeOngoingHuntsForBounty } from "../db/bounty-hunts";

export type CompletionResult =
  | {
      completed: true;
      bounty: Bounty;
    }
  | { completed: false };

export async function attemptBountyCompletion(
  scoreId: number,
  bountyId: string,
  userIdentity: UserIdentity,
): Promise<CompletionResult> {
  const parsedBountyId = uuidSchema.safeParse(bountyId);

  if (!parsedBountyId.success) throw new Error("Invalid/malformed bounty uuid");

  const bounty = await findBountyById(bountyId);

  if (!bounty) throw new BountyNotFoundError();
  if (bounty.status !== "open") throw new BountyNotOpenError();

  const goalBeatmapMetadata = await getBeatmap(bounty.goal.beatmapId).catch(
    () => {
      throw new BeatmapMetadataUnavailableError();
    },
  );

  const score = await fetchScore(scoreId);

  const bountyCompletionValidity = evaluateBountyCompletion(
    score,
    bounty,
    userIdentity,
    goalBeatmapMetadata,
  );

  const isBountyComplete = isBountyCompletionValid(bountyCompletionValidity);

  if (isBountyComplete) {
    const completedBounty = await completeBounty(
      bounty.id,
      score.id,
      userIdentity,
    );
    return { completed: true, bounty: completedBounty };
  } else return { completed: false };
}

export async function completeBounty(
  bountyId: string,
  scoreId: number,
  userIdentity: UserIdentity,
) {
  return db.transaction(async (tx) => {
    const bounty = await findBountyByIdForUpdate(tx, bountyId);
    if (!bounty) throw new BountyNotFoundError();

    const completedBounty = await markOpenBountyCompleted(
      tx,
      bountyId,
      userIdentity.osuUserId,
      scoreId,
    );

    if (!completedBounty) throw new BountyNotOpenError();

    const isUserCredited = await creditUserBp(
      tx,
      userIdentity.osuUserId,
      completedBounty.rewardBp,
    );

    if (!isUserCredited.ok) throw new PayoutRecipientNotFoundError();

    await createBountyRewardLedgerEntry(
      tx,
      completedBounty.id,
      isUserCredited.userId,
      completedBounty.rewardBp,
    );

    if (!completedBounty.completedAt) {
      throw new Error(
        "Completed bounty completedAt timestamp should not be null",
      );
    }

    await closeOngoingHuntsForBounty(
      tx,
      bountyId,
      new Date(completedBounty.completedAt),
    );

    return completedBounty;
  });
}
