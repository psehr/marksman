"use client";

import { useBountyFundingBreakdown } from "@/hooks/useBountyFundingBreakdown";
import Button from "@/components/ui/Button";
import BPIcon from "@/components/economy/BPIcon";
import { UserCard } from "@/components/users/UserCard";

export default function BountyFundingBreakdown({
  bountyId,
  rewardBp,
}: {
  bountyId: string;
  rewardBp: number;
}) {
  const { funders, status, retry } = useBountyFundingBreakdown(
    bountyId,
    rewardBp,
  );

  if (status === "loading") return <p>Loading funding...</p>;

  if (status === "errored") {
    return (
      <div role="alert">
        <p>Could not load funding.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }

  if (!funders.length) return <p>No funding recorded.</p>;

  return (
    <div className="flex flex-col w-full min-w-0 gap-2">
      <p className="text-xs italic w-full text-center text-foreground-muted">
        List of the players that funded this bounty, with their cumulated
        contributions
      </p>
      <ul>
        {funders.map(({ user, amountBp }) => (
          <li
            key={user.id}
            className="relative flex flex-col gap-2 py-2 sm:flex-row sm:items-center"
          >
            <div className="flex w-full h-20">
              <UserCard user={user} />
            </div>
            <div className="flex flex-col w-full items-center justify-center pointer-events-none sm:absolute sm:inset-0">
              <span className="inline-flex shrink-0 items-center place-content-center gap-1 tabular-nums text-accent text-2xl font-bold">
                {amountBp.toLocaleString()}
                <BPIcon size="sm" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
