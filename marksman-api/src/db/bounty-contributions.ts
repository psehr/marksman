import {
  BountyContribution,
  BountyFundingBreakdown,
} from "@marksman/contracts";
import { db, Transaction } from ".";
import { bountyContributions, users } from "./schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";

// Serialize retries before locking a bounty. Different bounties can share a key,
// so the bounty lock alone cannot protect the per-user idempotency lookup.
export async function lockContributionRequest(
  tx: Transaction,
  userId: string,
  idempotencyKey: string,
): Promise<void> {
  const lockKey = `bounty-contribution:${userId}:${idempotencyKey}`;
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
  );
}

export async function findContributionByIdempotencyKey(
  tx: Transaction,
  userId: string,
  idempotencyKey: string,
): Promise<BountyContribution | undefined> {
  const [row] = await tx
    .select()
    .from(bountyContributions)
    .where(
      and(
        eq(bountyContributions.userId, userId),
        eq(bountyContributions.idempotencyKey, idempotencyKey),
      ),
    );
  return row ? toBountyContribution(row) : undefined;
}

export function toBountyContribution(
  row: typeof bountyContributions.$inferSelect,
): BountyContribution {
  return {
    id: row.id,
    bountyId: row.bountyId,
    userId: row.userId,
    amountBp: row.amountBp,
    feeBp: row.feeBp,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function insertBountyContribution(
  tx: Transaction,
  bountyId: string,
  userId: string,
  amountBp: number,
  feeBp: number,
  idempotencyKey?: string,
): Promise<BountyContribution> {
  const [row] = await tx
    .insert(bountyContributions)
    .values({
      bountyId,
      userId,
      amountBp,
      feeBp,
      idempotencyKey,
    })
    .returning();

  return toBountyContribution(row);
}

export async function fetchBountyContributions(
  tx: Transaction | typeof db,
  bountyId: string,
): Promise<BountyContribution[]> {
  const rows = await tx
    .select()
    .from(bountyContributions)
    .where(eq(bountyContributions.bountyId, bountyId));

  return rows.map(toBountyContribution);
}

export async function fetchBountyFundingBreakdown(
  bountyId: string,
): Promise<BountyFundingBreakdown> {
  const totalPrincipal = sql<number>`
    sum(${bountyContributions.amountBp})
  `.mapWith(Number);

  return db
    .select({
      user: {
        id: users.id,
        osuUserId: users.osuUserId,
        username: users.username,
        coverUrl: users.coverUrl,
        countryCode: users.countryCode,
        countryName: users.countryName,
      },
      amountBp: totalPrincipal,
    })
    .from(bountyContributions)
    .innerJoin(users, eq(bountyContributions.userId, users.id))
    .where(eq(bountyContributions.bountyId, bountyId))
    .groupBy(users.id)
    .orderBy(desc(totalPrincipal), asc(users.id));
}
