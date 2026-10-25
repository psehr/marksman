import type { ExtendedBounty } from "@marksman/contracts";
import BountyCard from "./bounty_views/BountyCard";

export default function BountyList({
  bounties,
  hasBounties,
}: {
  bounties: ExtendedBounty[];
  hasBounties: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
      {bounties.map((bounty) => (
        <BountyCard key={bounty.id} bounty={bounty} />
      ))}
    </div>
  );
}
