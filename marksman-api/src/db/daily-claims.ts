import { Transaction } from ".";
import { dailyClaims } from "./schema";

export async function insertDailyClaim(
  tx: Transaction,
  userId: string,
  claimDate: string,
): Promise<boolean> {
  const [row] = await tx
    .insert(dailyClaims)
    .values({ userId, claimDate })
    .onConflictDoNothing({
      target: [dailyClaims.userId, dailyClaims.claimDate],
    })
    .returning();

  return !!row;
}
