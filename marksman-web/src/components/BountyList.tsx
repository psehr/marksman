import type { ExtendedBounty } from "@marksman/contracts";
import Bounty from "./Bounty";

export default function BountyList({
  bounties,
  hasBounties,
}: {
  bounties: ExtendedBounty[];
  hasBounties: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-2 w-3/4 h-full items-center">
      {bounties.length > 0 ? (
        bounties.map((bounty) => <Bounty bounty={bounty} key={bounty.id} />)
      ) : (
        <p>{hasBounties ? "No matching bounties" : "No bounties available"}</p>
      )}
    </div>
  );
}
