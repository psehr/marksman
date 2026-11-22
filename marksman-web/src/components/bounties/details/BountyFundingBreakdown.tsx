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
    <div className="flex flex-col w-full min-w-0">
      <p className="text-xs w-full text-center text-foreground-muted">
        List of the players that funded this bounty, with their cumulated
        contributions
      </p>
      <ul className="divide-y divide-border">
        {funders.map(({ user, amountBp }) => (
          <li
            key={user.id}
            className="relative flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
          >
            <UserCard user={user} />
            <div className="flex w-full items-center justify-center pointer-events-none sm:absolute sm:inset-0">
              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-accent text-3xl font-bold">
                {amountBp.toLocaleString()}
                <BPIcon size="md" />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
