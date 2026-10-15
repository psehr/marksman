import { LedgerEntry } from "@marksman/contracts";
import { getUserLedgerHistory } from "../db/ledger";

export async function fetchLedgerHistory(
  userId: string,
  page: number,
): Promise<LedgerEntry[]> {
  const entries = await getUserLedgerHistory(userId, page);

  return entries;
}
