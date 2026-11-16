import { BountyContribution } from "@marksman/contracts";
import { db, Transaction } from ".";
import { bountyContributions } from "./schema";
import { eq } from "drizzle-orm";

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
