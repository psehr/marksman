import type { DetailedUser, User } from "@marksman/contracts";

// Public profile responses are enriched; session/account fixtures remain User.
export function detailedUserFixture(
  user: User,
  stats: Partial<Pick<DetailedUser["stats"], "bountiesWon" | "bountyEarningsBp">> = {},
): DetailedUser {
  return {
    ...user,
    stats: {
      ...user.stats,
      bountiesWon: 0,
      bountyEarningsBp: 0,
      ...stats,
    },
  };
}
