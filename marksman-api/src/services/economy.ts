import {
  DailyClaimStatus,
  UserIdentity,
  DAILY_REWARD_BP,
} from "@marksman/contracts";
import { db } from "../db";
import { getDailyClaimForUser, insertDailyClaim } from "../db/daily-claims";
import { createDailyClaimLedgerEntry } from "../db/ledger";
import { creditUserBp } from "../db/users";

export async function attemptDailyClaim(user: UserIdentity): Promise<boolean> {
  return db.transaction(async (tx) => {
    const claimDate = new Date().toISOString().slice(0, 10);

    // if true means the insert went through and the user can actually claim the daily bp
    if (await insertDailyClaim(tx, user.id, claimDate)) {
      await createDailyClaimLedgerEntry(tx, user.id, DAILY_REWARD_BP);

      const isCredited = await creditUserBp(
        tx,
        user.osuUserId,
        DAILY_REWARD_BP,
      );

      if (!isCredited.ok) throw new Error("Could not credit user.");

      return true;
    } else return false;
  });
}

export async function fetchDailyClaimStatus(
  user: UserIdentity,
): Promise<DailyClaimStatus> {
  const now = new Date();
  const claimDate = now.toISOString().slice(0, 10);

  const claimedToday = await getDailyClaimForUser(db, user.id, claimDate);

  const nextClaim = new Date(now);
  nextClaim.setUTCHours(0, 0, 0, 0);
  nextClaim.setUTCDate(nextClaim.getUTCDate() + 1);

  return !claimedToday
    ? { claimedToday }
    : { claimedToday, nextClaimAt: nextClaim.toISOString() };
}
