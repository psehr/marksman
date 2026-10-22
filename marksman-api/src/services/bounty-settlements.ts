import { Bounty, HuntAttempt } from "@marksman/contracts";
import { db, Transaction } from "../db";
import {
  findBountyByIdForUpdate,
  markOpenBountyCompleted,
} from "../db/bounties";
import { findLeadingHuntAttempt } from "../db/bounty-hunts-attempts";
import {
  completeSettlementByBountyId,
  findBountySettlementByBountyId,
  findDueBountySettlements,
  postponeSettlement,
  scheduleSettlementRetry,
} from "../db/bounty-settlements";
import {
  BountyNotFoundError,
  BountyNotOpenError,
  HuntNotFoundError,
  PayoutRecipientNotFoundError,
  UserNotFoundError,
} from "./errors";
import { closeOngoingHuntsForBounty, findHuntById } from "../db/bounty-hunts";
import { creditUserBp, findUserByIdForUpdate } from "../db/users";
import { createBountyRewardLedgerEntry } from "../db/ledger";
import { isDiscoveryHealthy } from "./hunt-discovery";

export async function settleBounty(bountyId: string) {
  try {
    return await db.transaction(async (tx) => {
      const bounty = await findBountyByIdForUpdate(tx, bountyId);
      if (!bounty) throw new BountyNotFoundError();
      if (bounty.status !== "open") return;

      const now = new Date();

      const settlement = await findBountySettlementByBountyId(tx, bountyId);
      if (!settlement) return;
      if (
        settlement.settledAt !== null ||
        settlement.settleAfter > now ||
        settlement.nextAttemptAt > now
      )
        return;

      const leadingAttempt = await findLeadingHuntAttempt(tx, bountyId);
      if (!leadingAttempt) return;
      if (leadingAttempt.verificationStatus === "pending") {
        const nextAttemptAt = new Date(now.getTime() + 5_000);
        await postponeSettlement(tx, bountyId, nextAttemptAt);

        return;
      }

      await payoutBounty(tx, bounty, leadingAttempt, now);
    });
  } catch (error) {
    const nextAttemptAt = new Date(Date.now() + 5 * 60_000);
    const errorCode = "SETTLEMENT_FAILED";

    await scheduleSettlementRetry(db, bountyId, nextAttemptAt, errorCode);

    throw error;
  }
}

export async function payoutBounty(
  tx: Transaction,
  bounty: Bounty,
  attempt: HuntAttempt,
  now: Date,
) {
  const winnerHunt = await findHuntById(tx, attempt.huntId);
  if (!winnerHunt) throw new HuntNotFoundError();

  const user = await findUserByIdForUpdate(tx, winnerHunt.userId);
  if (!user) throw new UserNotFoundError();

  const completedBounty = await markOpenBountyCompleted(
    tx,
    bounty.id,
    user.identity.osuUserId,
    attempt.scoreId,
  );
  if (!completedBounty) throw new BountyNotOpenError();

  const isUserCredited = await creditUserBp(
    tx,
    user.identity.osuUserId,
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
    bounty.id,
    new Date(completedBounty.completedAt),
  );

  await completeSettlementByBountyId(tx, bounty.id, now);
}

export async function settleDueBounties(limit: number) {
  const dueBountySettlements = await findDueBountySettlements(
    db,
    new Date(),
    limit,
  );

  const failuresArray: { bountyId: string; error: unknown }[] = [];

  for (const dueSettlement of dueBountySettlements) {
    try {
      if (!isDiscoveryHealthy()) break;
      await settleBounty(dueSettlement.bountySettlements.bountyId);
    } catch (error) {
      failuresArray.push({
        bountyId: dueSettlement.bountySettlements.bountyId,
        error,
      });
    }
  }

  return failuresArray;
}
