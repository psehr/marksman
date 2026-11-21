"use client";

import CopyText from "@/components/ui/CopyText";

export default function ShareBounty({ bountyId }: { bountyId: string }) {
  return (
    <CopyText
      key={bountyId}
      text={() => new URL(`/bounties/${bountyId}`, window.location.origin).href}
      label="Share bounty"
      copiedMessage="Link copied!"
      errorMessage="Could not copy the link. You can copy it below."
      fallbackLabel="Bounty link"
    />
  );
}
