"use client";

import ActionIcon from "@/components/ui/ActionIcon";

import type { ExtendedBounty } from "@marksman/contracts";
import { useAuth } from "../../auth/AuthProvider";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import BountyHunt from "@/components/hunts/BountyHunt";
import { useBountyActions } from "@/hooks/useBountyActions";
import HuntControls from "@/components/hunts/HuntControls";
import type { ReactNode } from "react";
import BeatmapActions from "./BeatmapActions";
import ShareBounty from "./ShareBounty";

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

function ConnectedActions({
  bounty,
  refresh,
  refreshEngagement,
  availableActions,
}: Props) {
  const { refreshUser } = useAuth();
  const { cancel, bookmark } = useBountyActions(
    bounty.id,
    bounty.engagement.isBookmarkedByCurrentUser === true,
    async () => {
      refresh();
      await refreshUser();
    },
    refreshEngagement,
  );
  const { canCancel, canHunt, canBookmark, canUnbookmark } = availableActions;

  function renderActions(huntControls?: ReactNode) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-4">
        {huntControls}
        {canCancel && (
          <div className="flex flex-col gap-2 col-span-full">
            <Button
              size="lg"
              variant="danger"
              disabled={cancel.pending}
              onClick={() => void cancel.run()}
            >
              <ActionIcon action={cancel.pending ? "refresh" : "cancel"} />
              {cancel.pending ? "Cancelling..." : "Cancel bounty"}
            </Button>
            {cancel.error && <p role="alert">{cancel.error}</p>}
          </div>
        )}
        <BeatmapActions bounty={bounty} />
        {(canBookmark || canUnbookmark) && (
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={bookmark.pending}
              onClick={() => void bookmark.run()}
            >
              <ActionIcon action={bookmark.pending || bookmark.refreshFailed ? "refresh" : canUnbookmark ? "bookmarked" : "bookmark"} />
              {bookmark.pending
                ? "Saving..."
                : bookmark.refreshFailed
                  ? "Retry refresh"
                  : canUnbookmark
                    ? "Unbookmark"
                    : "Bookmark"}
            </Button>
            {bookmark.error && <p role="alert">{bookmark.error}</p>}
          </div>
        )}
        <ShareBounty key={bounty.id} bountyId={bounty.id} />
      </div>
    );
  }

  return canHunt ? (
    <BountyHunt bounty={bounty}>
      {(controls) => (
        <>
          {controls.ready && !controls.loading && controls.isHunting ? (
            <div className="flex flex-col gap-1">
              <p role="status" className="text-sm text-accent text-center">
                You are currently hunting this bounty.
              </p>
              <p
                role="status"
                className="text-xs text-foreground-muted text-center"
              >
                Marksman tracks your submitted scores on this beatmap.
              </p>
            </div>
          ) : null}
          {renderActions(<HuntControls {...controls} />)}
        </>
      )}
    </BountyHunt>
  ) : (
    renderActions()
  );
}

export default function BountyActions(props: Props) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Loading actions...</p>;
  if (!props.isAuthenticated || !user) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ButtonLink
          size="lg"
          variant="accent"
          href={`${process.env.NEXT_PUBLIC_API_URL}/auth/osu`}
        >
          Log in with osu! to interact
        </ButtonLink>
        <ShareBounty key={props.bounty.id} bountyId={props.bounty.id} />
        <BeatmapActions bounty={props.bounty} />
      </div>
    );
  }
  return (
    <ConnectedActions
      key={`${user.identity.id}:${props.bounty.id}`}
      {...props}
    />
  );
}
