import { db, Transaction } from ".";
import { dailyClaims } from "./schema";
import { eq, and } from "drizzle-orm";

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

export async function getDailyClaimForUser(
  tx: Transaction | typeof db,
  userId: string,
  claimDate: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ userId: dailyClaims.userId })
    .from(dailyClaims)
    .where(
      and(eq(dailyClaims.userId, userId), eq(dailyClaims.claimDate, claimDate)),
    );

  return !!row;
}
