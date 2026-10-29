import { db } from "../db";
import type { Bounty, CreateBountyInput } from "@marksman/contracts";
import {
  createBounty,
  findBountyByIdForUpdate,
  markOpenBountyCancelled,
} from "../db/bounties";
import { creditUserBp, deductUserBp, findUserByOsuId } from "../db/users";
import {
  BountyNotFoundError,
  BountyNotOpenError,
  BountyNotOwnedError,
  CreatorNotFoundError,
  InsufficientBpError,
} from "./errors";
import {
  createBountyFeeLedgerEntry,
  createFundingLedgerEntry,
  createRefundLedgerEntry,
} from "../db/ledger";
import { getBeatmap } from "../integrations/osu/beatmaps";
import { closeOngoingHuntsForBounty } from "../db/bounty-hunts";
import { toBountyBeatmapMetadata } from "../adapters/beatmap";
import { upsertBountyBeatmap } from "../db/bounty-beatmaps";

export async function createFundedBounty(
  input: CreateBountyInput,
  creatorOsuUserId: number,
): Promise<Bounty> {
  // populating beatmap checksum from osu! API
  const osuBeatmapMetadata = await getBeatmap(input.goal.beatmapId);
  const extendedInput = {
    ...input,
    goal: { ...input.goal, beatmapChecksum: osuBeatmapMetadata.checksum },
  };

  const bountyBeatmapMetadata = toBountyBeatmapMetadata(osuBeatmapMetadata);

  return db.transaction(async (tx) => {
    const FUNDING_FEE_PERCENTAGE = 10;

    const REWARD_COST = input.rewardBp;
    const FEE_COST = Math.ceil(REWARD_COST * (FUNDING_FEE_PERCENTAGE / 100));

    const TOTAL_FUNDING_COST = REWARD_COST + FEE_COST;

    const deducted = await deductUserBp(
      tx,
      creatorOsuUserId,
      TOTAL_FUNDING_COST,
    );

    if (!deducted.ok) {
      const creator = await findUserByOsuId(creatorOsuUserId, tx);

      if (!creator) {
        throw new CreatorNotFoundError();
      }

      throw new InsufficientBpError();
    }

    const bounty = await createBounty(tx, extendedInput, creatorOsuUserId);

    await upsertBountyBeatmap(tx, bountyBeatmapMetadata);

    await createFundingLedgerEntry(
      tx,
      bounty.id,
      -input.rewardBp,
      deducted.userId,
    );

    await createBountyFeeLedgerEntry(tx, deducted.userId, bounty.id, -FEE_COST);

    return bounty;
  });
}

export async function cancelBounty(
  bountyId: string,
  requesterOsuUserId: number,
): Promise<Bounty> {
  return db.transaction(async (tx) => {
    const bounty = await findBountyByIdForUpdate(tx, bountyId);

    if (!bounty) throw new BountyNotFoundError();

    if (bounty.creatorOsuUserId !== requesterOsuUserId) {
      throw new BountyNotOwnedError();
    }

    if (bounty.status !== "open") {
      throw new BountyNotOpenError();
    }

    const cancelledBounty = await markOpenBountyCancelled(
      tx,
      bountyId,
      requesterOsuUserId,
    );

    if (!cancelledBounty) {
      throw new Error(
        "Bounty cancellation failed despite matching eligibility",
      );
    }

    const refunded = await creditUserBp(
      tx,
      bounty.creatorOsuUserId,
      bounty.rewardBp,
    );

    if (!refunded.ok) {
      throw new Error("Could not refund, cancellation aborted");
    }

    await createRefundLedgerEntry(
      tx,
      bounty.id,
      bounty.rewardBp,
      refunded.userId,
    );

    if (!cancelledBounty.cancelledAt) {
      throw new Error(
        "Cancelled bounty cancelledAt timestamp should not be null",
      );
    }

    await closeOngoingHuntsForBounty(
      tx,
      bounty.id,
      new Date(cancelledBounty.cancelledAt),
    );

    return cancelledBounty;
  });
}
