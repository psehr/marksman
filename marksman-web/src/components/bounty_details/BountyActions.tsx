"use client";

import type { ExtendedBounty } from "@marksman/contracts";
import { useAuth } from "../AuthProvider";
import Button from "../buttons/Button";
import ButtonLink from "../buttons/ButtonLink";
import BountyHunt from "../BountyHunt";
import { useBountyActions } from "@/hooks/useBountyActions";

export type AvailableActions = {
  canCancel: boolean;
  canHunt: boolean;
  canBookmark: boolean;
  canUnbookmark: boolean;
};

type Props = {
  bounty: ExtendedBounty;
  refresh: () => void;
  refreshEngagement: () => Promise<void>;
  availableActions: AvailableActions;
  isAuthenticated: boolean;
};

function ConnectedActions({ bounty, refresh, refreshEngagement, availableActions }: Props) {
  const { refreshUser } = useAuth();
  const { cancel, bookmark } = useBountyActions(
    bounty.id,
    bounty.engagement.isBookmarkedByCurrentUser === true,
    async () => { refresh(); await refreshUser(); },
    refreshEngagement,
  );
  const { canCancel, canHunt, canBookmark, canUnbookmark } = availableActions;

  if (!canCancel && !canHunt && !canBookmark && !canUnbookmark) {
    return <p>There are currently no available actions</p>;
  }

  return (
    <div className={`grid items-start gap-4 ${canHunt && (canBookmark || canUnbookmark) ? "grid-cols-2" : "grid-cols-1"}`}>
      {canHunt && <BountyHunt bounty={bounty} />}
      {(canBookmark || canUnbookmark) && (
        <div className="flex flex-col gap-2">
          <Button size="lg" disabled={bookmark.pending} onClick={() => void bookmark.run()}>
            {bookmark.pending ? "Saving..." : bookmark.refreshFailed ? "Retry refresh" : canUnbookmark ? "Unbookmark" : "Bookmark"}
          </Button>
          {bookmark.error && <p role="alert">{bookmark.error}</p>}
        </div>
      )}
      {canCancel && (
        <div className="flex flex-col gap-2">
          <Button size="lg" variant="danger" disabled={cancel.pending} onClick={() => void cancel.run()}>
            {cancel.pending ? "Cancelling..." : "Cancel bounty"}
          </Button>
          {cancel.error && <p role="alert">{cancel.error}</p>}
        </div>
      )}
    </div>
  );
}

export default function BountyActions(props: Props) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Loading actions...</p>;
  if (!props.isAuthenticated || !user) {
    return <ButtonLink size="lg" variant="accent" href={`${process.env.NEXT_PUBLIC_API_URL}/auth/osu`}>Log in with osu! to interact</ButtonLink>;
  }
  return <ConnectedActions key={`${user.identity.id}:${props.bounty.id}`} {...props} />;
}
