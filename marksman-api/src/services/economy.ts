import { UserIdentity } from "@marksman/contracts";
import { db } from "../db";
import { insertDailyClaim } from "../db/daily-claims";
import { createDailyClaimLedgerEntry } from "../db/ledger";
import { creditUserBp } from "../db/users";

export async function attemptDailyClaim(user: UserIdentity): Promise<boolean> {
  return db.transaction(async (tx) => {
    const claimDate = new Date().toISOString().slice(0, 10);

    // daily BP reward potentially awarded to the user
    const DAILY_REWARD = 25;

    // if true means the insert went through and the user can actually claim the daily bp
    if (await insertDailyClaim(tx, user.id, claimDate)) {
      await createDailyClaimLedgerEntry(tx, user.id, DAILY_REWARD);

      const isCredited = await creditUserBp(tx, user.osuUserId, DAILY_REWARD);

      if (!isCredited.ok) throw new Error("Could not credit user.");

      return true;
    } else return false;
  });
}
