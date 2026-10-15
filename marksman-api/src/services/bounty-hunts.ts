import { Hunt, UserIdentity } from "@marksman/contracts";
import { db } from "../db";
import { findBountyByIdForUpdate } from "../db/bounties";
import {
  BountyNotFoundError,
  BountyNotOpenError,
  BountyOwnHuntError,
  HuntNotOngoingError,
  HuntNotOwnedError,
  HuntSlotsFullError,
  HuntNotFoundError,
  UserNotFoundError,
  DuplicateHuntingError,
} from "./errors";
import { findUserByIdForUpdate } from "../db/users";
import {
  markHuntStopped,
  countUserOngoingHunts,
  findHuntById,
  findHuntByIdForUpdate,
  insertHunt,
  isUserHuntingBounty,
} from "../db/bounty-hunts";

export async function startHunt(
  identity: UserIdentity,
  bountyId: string,
): Promise<Hunt> {
  return await db.transaction(async (tx) => {
    const MAXIMUM_HUNTING_SLOTS = 2;

    const bounty = await findBountyByIdForUpdate(tx, bountyId);

    if (!bounty) throw new BountyNotFoundError();
    if (bounty.status !== "open") throw new BountyNotOpenError();
    if (bounty.creatorOsuUserId === identity.osuUserId)
      throw new BountyOwnHuntError();

    const user = await findUserByIdForUpdate(tx, identity.id);

    if (!user) throw new UserNotFoundError();

    const now = new Date();

    // checking if user is already hunting this specific bounty
    if (await isUserHuntingBounty(tx, identity.id, bountyId))
      throw new DuplicateHuntingError();

    // checking if user has an available hunting slot to fill
    if ((await countUserOngoingHunts(tx, identity.id)) >= MAXIMUM_HUNTING_SLOTS)
      throw new HuntSlotsFullError();

    const hunt = await insertHunt(tx, identity.id, bountyId, now);

    return hunt;
  });
}

export async function stopHunt(
  identity: UserIdentity,
  huntId: string,
): Promise<Hunt> {
  const result = await db.transaction(async (tx) => {
    const huntFirstRead = await findHuntById(tx, huntId);
    if (!huntFirstRead) throw new HuntNotFoundError();
    if (huntFirstRead.userId !== identity.id) throw new HuntNotOwnedError();

    const bounty = await findBountyByIdForUpdate(tx, huntFirstRead.bountyId);
    if (!bounty) throw new BountyNotFoundError();
    if (bounty.status !== "open") throw new BountyNotOpenError();

    const user = await findUserByIdForUpdate(tx, identity.id);
    if (!user) throw new UserNotFoundError();

    const huntSecondRead = await findHuntByIdForUpdate(tx, huntId);

    const now = new Date();

    if (!huntSecondRead) throw new HuntNotFoundError();
    if (huntSecondRead.userId !== identity.id) throw new HuntNotOwnedError();
    if (huntSecondRead.status !== "ongoing") throw new HuntNotOngoingError();

    const updatedHunt = markHuntStopped(tx, huntId, now);

    return updatedHunt;
  });

  return result;
}
