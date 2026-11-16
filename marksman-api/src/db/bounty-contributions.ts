import { BountyContribution } from "@marksman/contracts";
import { Transaction } from ".";
import { bountyContributions } from "./schema";

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
): Promise<BountyContribution> {
  const [row] = await tx
    .insert(bountyContributions)
    .values({
      bountyId,
      userId,
      amountBp,
      feeBp,
    })
    .returning();

  return toBountyContribution(row);
}
