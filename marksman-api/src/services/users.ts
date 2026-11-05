import { DetailedUser, User } from "@marksman/contracts";
import { db } from "../db";
import { upsertUserFromOsuProfile } from "../db/users";
import { CreateUserInput } from "../models/user";
import { getBountyWinStats } from "../db/bounties";

export async function registerOrUpdateUserFromOsuProfile(
  input: CreateUserInput,
): Promise<User> {
  return db.transaction(async (tx) => {
    return upsertUserFromOsuProfile(tx, input);
  });
}

export async function enrichUser(user: User): Promise<DetailedUser> {
  const stats = await getBountyWinStats(user);

  const completeStats: DetailedUser["stats"] = {
    bpBalance: user.stats.bpBalance,
    bountiesWon: stats.bountiesWon,
    bountyEarningsBp: stats.bountyEarningsBp,
  };

  return { ...user, stats: completeStats };
}
