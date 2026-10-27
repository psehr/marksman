import { PROFILE_HISTORY_PAGE_SIZE } from "@marksman/contracts";
import { LedgerEntry } from "@marksman/contracts";
import { db, Transaction } from "./index";
import { ledgerEntries } from "./schema";
import { desc, eq } from "drizzle-orm";

export function toLedgerEntry(
  row: typeof ledgerEntries.$inferSelect,
): LedgerEntry {
  return {
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    reason: row.reason,
    bountyId: row.bountyId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getUserLedgerHistory(
  userId: string,
  page: number,
): Promise<LedgerEntry[]> {
  const pageNumber = Number.isInteger(page) && page > 0 ? page : 1;

  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, userId))
    .orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id))
    .limit(PROFILE_HISTORY_PAGE_SIZE)
    .offset((pageNumber - 1) * PROFILE_HISTORY_PAGE_SIZE);

  return rows.map(toLedgerEntry);
}

export async function createFundingLedgerEntry(
  tx: Transaction,
  bountyId: string,
  amount: number,
  userId: string,
): Promise<LedgerEntry> {
  if (amount >= 0)
    throw new Error("A funding ledger entry must have a negative amount.");

  const [row] = await tx
    .insert(ledgerEntries)
    .values({
      amount,
      userId,
      bountyId,
      reason: "bounty_funding",
    })
    .returning();

  return toLedgerEntry(row);
}

export async function createRefundLedgerEntry(
  tx: Transaction,
  bountyId: string,
  amount: number,
  userId: string,
): Promise<LedgerEntry> {
  if (amount < 0)
    throw new Error("A refund ledger entry cannot have a negative amount.");

  const [row] = await tx
    .insert(ledgerEntries)
    .values({
      amount,
      userId,
      bountyId,
      reason: "bounty_refund",
    })
    .returning();

  return toLedgerEntry(row);
}

export async function createBountyRewardLedgerEntry(
  tx: Transaction,
  bountyId: string,
  userId: string,
  amount: number,
): Promise<LedgerEntry> {
  if (amount <= 0)
    throw new Error("A bounty reward ledger entry must be positive");

  const [row] = await tx
    .insert(ledgerEntries)
    .values({
      amount,
      userId,
      bountyId,
      reason: "bounty_reward",
    })
    .returning();

  return toLedgerEntry(row);
}

export async function createInitialGrantLedgerEntry(
  tx: Transaction,
  userId: string,
  amount: number,
) {
  if (amount <= 0)
    throw new Error("A user's initial grant ledger entry must be positive.");

  const [row] = await tx
    .insert(ledgerEntries)
    .values({
      amount,
      userId,
      reason: "initial_grant",
    })
    .returning();

  return toLedgerEntry(row);
}

export async function createDailyClaimLedgerEntry(
  tx: Transaction,
  userId: string,
  amount: number,
) {
  if (amount <= 0)
    throw new Error("Daily claim ledger entry amount must be positive.");

  const [row] = await tx
    .insert(ledgerEntries)
    .values({ amount, userId, reason: "daily_claim" })
    .returning();

  return toLedgerEntry(row);
}

export async function createBountyFeeLedgerEntry(
  tx: Transaction,
  userId: string,
  bountyId: string,
  amount: number,
) {
  if (amount >= 0)
    throw new Error("Bounty fee ledger entry amount must be negative");

  const [row] = await tx
    .insert(ledgerEntries)
    .values({ amount, userId, bountyId, reason: "bounty_fee" })
    .returning();

  return toLedgerEntry(row);
}
