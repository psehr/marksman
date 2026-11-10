"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import HuntControls from "./HuntControls";
import { useHunt } from "@/hooks/useHunt";
import type { ExtendedBounty } from "@marksman/contracts";
import type { ReactNode } from "react";

type HuntContent = (controls: ReturnType<typeof useHunt>) => ReactNode;

function ConnectedHuntControls({ bountyId, children }: { bountyId: string; children?: HuntContent }) {
  const controls = useHunt(bountyId);
  return children ? children(controls) : <HuntControls {...controls} />;
}

export default function BountyHunt({ bounty, children }: { bounty: ExtendedBounty; children?: HuntContent }) {
  const { user, loading } = useAuth();
  if (
    loading ||
    !user ||
    bounty.status !== "open" ||
    bounty.creatorOsuUserId === user.identity.osuUserId
  )
    return null;

  // A new identity/route gets fresh state immediately, including pending actions.
  return (
    <ConnectedHuntControls
      key={`${user.identity.id}:${bounty.id}`}
      bountyId={bounty.id}
    >
      {children}
    </ConnectedHuntControls>
  );
}
