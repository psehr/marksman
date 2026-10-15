import { User } from "@marksman/contracts";
import { db } from "../db";
import { findBountyById, findBountyByIdForUpdate } from "../db/bounties";
import {
  deleteBountyBookmark,
  insertBountyBookmark,
  listBountiesBookmarkedByUserId,
} from "../db/bounty-bookmarks";
import {
  BountyNotFoundError,
  BountyNotOpenError,
  BountyOwnBookmarkError,
} from "./errors";
import { enrichBounties } from "./bounty-enrichment";

export async function bookmarkBounty(
  user: Pick<User["identity"], "id" | "osuUserId">,
  bountyId: string,
) {
  return db.transaction(async (tx) => {
    const bounty = await findBountyByIdForUpdate(tx, bountyId);

    if (!bounty) throw new BountyNotFoundError();
    if (bounty.status !== "open") throw new BountyNotOpenError();
    if (bounty.creatorOsuUserId === user.osuUserId)
      throw new BountyOwnBookmarkError();
    await insertBountyBookmark(tx, user.id, bountyId);
  });
}

export async function unbookmarkBounty(userId: string, bountyId: string) {
  const bounty = await findBountyById(bountyId);

  if (!bounty) throw new BountyNotFoundError();

  await deleteBountyBookmark(userId, bountyId);
}

export async function getBookmarkedBounties(userId: string) {
  const bounties = await listBountiesBookmarkedByUserId(userId);

  return await enrichBounties(bounties);
}
