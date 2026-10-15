import { bounties, bountyBookmarks } from "./schema";
import { db, type Transaction } from "./index";
import { and, count, eq, getTableColumns, inArray } from "drizzle-orm";
import { Bounty } from "@marksman/contracts";
import { toBounty } from "./bounties";

export async function insertBountyBookmark(
  tx: Transaction,
  userId: string,
  bountyId: string,
): Promise<boolean> {
  const [row] = await tx
    .insert(bountyBookmarks)
    .values({
      userId,
      bountyId,
    })
    .onConflictDoNothing()
    .returning();

  return !!row;
}

export async function deleteBountyBookmark(
  userId: string,
  bountyId: string,
): Promise<void> {
  await db
    .delete(bountyBookmarks)
    .where(
      and(
        eq(bountyBookmarks.userId, userId),
        eq(bountyBookmarks.bountyId, bountyId),
      ),
    );
}

export async function countBookmarksByBountyIds(
  bountyIds: string[],
): Promise<{ bountyId: string; bookmarkCount: number }[]> {
  return await db
    .select({ bountyId: bountyBookmarks.bountyId, bookmarkCount: count() })
    .from(bountyBookmarks)
    .where(inArray(bountyBookmarks.bountyId, bountyIds))
    .groupBy(bountyBookmarks.bountyId);
}

export async function isBountyBookmarkedByUser(
  bountyId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(bountyBookmarks)
    .where(
      and(
        eq(bountyBookmarks.bountyId, bountyId),
        eq(bountyBookmarks.userId, userId),
      ),
    );

  return Boolean(row);
}

export async function listBountiesBookmarkedByUserId(
  userId: string,
): Promise<Bounty[]> {
  const rows = await db
    .select(getTableColumns(bounties))
    .from(bountyBookmarks)
    .innerJoin(bounties, eq(bounties.id, bountyBookmarks.bountyId))
    .where(eq(bountyBookmarks.userId, userId));

  return rows.map(toBounty);
}
