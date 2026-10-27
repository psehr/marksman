import type { ExtendedBounty } from "@marksman/contracts";
import BountyCard from "./BountyCard";

export default function BountyList({
  bounties,
  hasBounties,
}: {
  bounties: ExtendedBounty[];
  hasBounties: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
      {bounties.length > 0 ? (
        bounties.map((bounty) => <BountyCard key={bounty.id} bounty={bounty} />)
      ) : hasBounties ? (
        <p className="col-span-full text-center">No bounties found</p>
      ) : (
        <p className="col-span-full text-center">No bounties to display</p>
      )}
    </div>
  );
}
