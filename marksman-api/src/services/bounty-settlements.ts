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

export async function settleBounty(bountyId: string) {
  return db.transaction(async (tx) => {
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
    if (!leadingAttempt || leadingAttempt.verificationStatus === "pending")
      return;

    await payoutBounty(tx, bounty, leadingAttempt, now);
  });
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
