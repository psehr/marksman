"use client";

import { useAuth } from "./AuthProvider";
import HuntControls from "./HuntControls";
import { useHunt } from "@/hooks/useHunt";
import type { ExtendedBounty } from "@marksman/contracts";

function ConnectedHuntControls({ bountyId }: { bountyId: string }) {
  const controls = useHunt(bountyId);
  return <HuntControls {...controls} />;
}

export default function BountyHunt({ bounty }: { bounty: ExtendedBounty }) {
  const { user, loading } = useAuth();
  if (loading || !user || bounty.status !== "open" ||
      bounty.creatorOsuUserId === user.identity.osuUserId) return null;

  // A new identity/route gets fresh state immediately, including pending actions.
  return <ConnectedHuntControls key={`${user.identity.id}:${bounty.id}`} bountyId={bounty.id} />;
}
