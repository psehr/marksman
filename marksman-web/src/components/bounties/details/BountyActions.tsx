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
import BountyStatusDescriptor from "./BountyStatusDescriptor";

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
  fundingAction: ReactNode;
};

function ConnectedActions({
  bounty,
  refresh,
  refreshEngagement,
  availableActions,
  fundingAction,
}: Props) {
  const { user, refreshUser } = useAuth();
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
        {(canBookmark || canUnbookmark) && (bounty.status === "open" || bookmark.isBookmarked || bookmark.refreshFailed) && (
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={bookmark.pending}
              onClick={() => void bookmark.run()}
            >
              <ActionIcon
                action={
                  bookmark.pending || bookmark.refreshFailed
                    ? "refresh"
                    : bookmark.isBookmarked
                      ? "bookmarked"
                      : "bookmark"
                }
              />
              {bookmark.pending
                ? "Saving..."
                : bookmark.refreshFailed
                  ? "Retry refresh"
                  : bookmark.isBookmarked
                    ? "Unbookmark"
                    : "Bookmark"}
            </Button>
            {bookmark.error && <p role="alert">{bookmark.error}</p>}
          </div>
        )}
        {fundingAction}
        <ShareBounty key={bounty.id} bountyId={bounty.id} />
      </div>
    );
  }

  return canHunt ? (
    <BountyHunt bounty={bounty}>
      {(controls) => (
        <>
          {controls.ready && !controls.loading ? (
            <BountyStatusDescriptor
              bounty={bounty}
              osuUserId={user?.identity.osuUserId}
              isHunting={controls.isHunting}
            />
          ) : null}
          {renderActions(<HuntControls {...controls} />)}
        </>
      )}
    </BountyHunt>
  ) : (
    <>
      <BountyStatusDescriptor
        bounty={bounty}
        osuUserId={user?.identity.osuUserId}
        isHunting={false}
      />
      {renderActions()}
    </>
  );
}

export default function BountyActions(props: Props) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Loading actions...</p>;
  if (!props.isAuthenticated || !user) {
    return (
      <>
        {props.bounty.status !== "open" ? (
          <BountyStatusDescriptor bounty={props.bounty} isHunting={false} />
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ButtonLink
            size="lg"
            variant="accent"
            href={`${process.env.NEXT_PUBLIC_API_URL}/auth/osu`}
          >
            <ActionIcon action="sign-in" />
            Log in with osu! to interact
          </ButtonLink>
          <ShareBounty key={props.bounty.id} bountyId={props.bounty.id} />
          <BeatmapActions bounty={props.bounty} />
        </div>
      </>
    );
  }
  return (
    <ConnectedActions
      key={`${user.identity.id}:${props.bounty.id}`}
      {...props}
    />
  );
}
