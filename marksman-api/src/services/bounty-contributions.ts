import {
  bountyContributionRequestSchema,
  BountyFundingBreakdown,
  MAX_BOUNTY_REWARD_BP,
  type BountyContribution,
  type BountyContributionRequest,
} from "@marksman/contracts";
import { db } from "../db";
import {
  findBountyById,
  findBountyByIdForUpdate,
  increaseOpenBountyReward,
} from "../db/bounties";
import {
  fetchBountyFundingBreakdown,
  findContributionByIdempotencyKey,
  insertBountyContribution,
  lockContributionRequest,
} from "../db/bounty-contributions";
import {
  createBountyFeeLedgerEntry,
  createFundingLedgerEntry,
} from "../db/ledger";
import { deductUserBpById, findUserByIdForUpdate } from "../db/users";
import { uuidSchema } from "../models/common";
import {
  BountyNotFoundError,
  BountyNotOpenError,
  BountyRewardLimitError,
  ContributionIdempotencyConflictError,
  InsufficientBpError,
  UserNotFoundError,
} from "./errors";

export async function contributeToBounty(
  bountyId: string,
  userId: string,
  input: BountyContributionRequest,
): Promise<BountyContribution> {
  // Canonicalize UUIDs for the advisory lock and replay comparison, matching
  // PostgreSQL's case-insensitive UUID storage semantics.
  const targetId = uuidSchema.parse(bountyId).toLowerCase();
  const contributorId = uuidSchema.parse(userId).toLowerCase();
  const parsed = bountyContributionRequestSchema.parse(input);
  const key = parsed.idempotencyKey.toLowerCase();
  const amountBp = parsed.amountBp;

  return db.transaction(async (tx) => {
    await lockContributionRequest(tx, contributorId, key);
    const previous = await findContributionByIdempotencyKey(
      tx,
      contributorId,
      key,
    );
    if (previous) {
      if (previous.bountyId !== targetId || previous.amountBp !== amountBp) {
        throw new ContributionIdempotencyConflictError();
      }
      // A successful request remains replayable after cancellation/completion,
      // balance changes, or subsequent funding has filled the bounty to its cap.
      return previous;
    }

    const bounty = await findBountyByIdForUpdate(tx, targetId);
    if (!bounty) throw new BountyNotFoundError();
    if (bounty.status !== "open") throw new BountyNotOpenError();
    if (bounty.rewardBp + amountBp > MAX_BOUNTY_REWARD_BP) {
      throw new BountyRewardLimitError();
    }

    const user = await findUserByIdForUpdate(tx, contributorId);
    if (!user) throw new UserNotFoundError();
    const feeBp = Math.ceil(amountBp / 10);
    const deducted = await deductUserBpById(
      tx,
      contributorId,
      amountBp + feeBp,
    );
    if (!deducted.ok) throw new InsufficientBpError();

    const contribution = await insertBountyContribution(
      tx,
      targetId,
      contributorId,
      amountBp,
      feeBp,
      key,
    );
    await createFundingLedgerEntry(tx, targetId, -amountBp, contributorId);
    await createBountyFeeLedgerEntry(tx, contributorId, targetId, -feeBp);
    const updated = await increaseOpenBountyReward(tx, targetId, amountBp);
    if (!updated)
      throw new Error("Could not update bounty reward, contribution aborted");
    return contribution;
  });
}

export async function getBountyFundingBreakdown(
  bountyId: string,
): Promise<BountyFundingBreakdown> {
  const bounty = await findBountyById(db, bountyId);
  if (!bounty) throw new BountyNotFoundError();

  return fetchBountyFundingBreakdown(bountyId);
}
