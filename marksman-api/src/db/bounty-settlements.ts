import { eq, and, isNull, lte, asc } from "drizzle-orm";
import { db, Transaction } from ".";
import { bounties, bountySettlements } from "./schema";

export async function ensureBountySettlement(
  connection: Transaction | typeof db,
  bountyId: string,
  openedAt: Date,
) {
  const GRACE_PERIOD = 30_000;

  await connection
    .insert(bountySettlements)
    .values({
      bountyId,
      openedAt,
      settleAfter: new Date(openedAt.getTime() + GRACE_PERIOD),
      nextAttemptAt: new Date(openedAt.getTime() + GRACE_PERIOD),
    })
    .onConflictDoNothing({ target: bountySettlements.bountyId });
}

export async function findDueBountySettlements(
  connection: Transaction | typeof db,
  now: Date,
  limit: number,
) {
  const rows = await connection
    .select({ bountySettlements })
    .from(bountySettlements)
    .innerJoin(bounties, eq(bounties.id, bountySettlements.bountyId))
    .where(
      and(
        isNull(bountySettlements.settledAt),
        lte(bountySettlements.settleAfter, now),
        lte(bountySettlements.nextAttemptAt, now),
        eq(bounties.status, "open"),
      ),
    )
    .orderBy(
      asc(bountySettlements.nextAttemptAt),
      asc(bountySettlements.bountyId),
    )
    .limit(limit);

  return rows;
}

export async function findBountySettlementByBountyId(
  connection: Transaction | typeof db,
  bountyId: string,
) {
  const [row] = await connection
    .select()
    .from(bountySettlements)
    .where(eq(bountySettlements.bountyId, bountyId));

  return row;
}

export async function completeSettlementByBountyId(
  connection: Transaction | typeof db,
  bountyId: string,
  now: Date,
) {
  await connection
    .update(bountySettlements)
    .set({ settledAt: now })
    .where(eq(bountySettlements.bountyId, bountyId));
}
