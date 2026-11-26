"use client";

import type { ExtendedBounty } from "@marksman/contracts";
import { useAuth } from "../auth/AuthProvider";
import { useBountyActions } from "@/hooks/useBountyActions";
import { useHunt } from "@/hooks/useHunt";
import BountyHunt from "../hunts/BountyHunt";
import ActionIcon from "../ui/ActionIcon";

const buttonStyle = "flex size-8 items-center justify-center rounded border cursor-pointer transition-colors hover:bg-card/50 hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-40";

type Props = { bounty: ExtendedBounty; refresh: () => Promise<void> };

function HuntButton(controls: ReturnType<typeof useHunt>) {
  const label = controls.loading ? "Loading hunt..." : controls.pending ? "Updating hunt..."
    : !controls.ready ? "Reload bounty hunts" : controls.isHunting ? "Stop hunting bounty" : "Start hunting bounty";
  return (
    <div>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={controls.ready ? controls.isHunting : undefined}
        disabled={controls.loading || controls.pending}
        className={`${buttonStyle} ${controls.isHunting ? "text-accent border-accent/40" : "text-foreground-muted/60 border-border/20"}`}
        onClick={() => { if (controls.ready) void controls.onToggle(); else controls.onRefresh(); }}
      >
        <ActionIcon action={controls.loading || controls.pending || !controls.ready ? "refresh" : "hunt"} />
      </button>
    </div>
  );
}

function ConnectedActions({ bounty, refresh }: Props) {
  const { bookmark } = useBountyActions(bounty.id, bounty.engagement.isBookmarkedByCurrentUser === true,
    () => {}, refresh);
  const canBookmark = bounty.status === "open" || bookmark.isBookmarked || bookmark.refreshFailed;
  const label = bookmark.pending ? "Saving bounty bookmark..." : bookmark.refreshFailed ? "Retry bookmark refresh"
    : bookmark.isBookmarked ? "Remove bounty bookmark" : "Bookmark bounty";
  function renderActions(controls?: ReturnType<typeof useHunt>) {
    return (
      <div className="absolute right-2 top-2 z-20 flex gap-1">
        {controls && <HuntButton {...controls} />}
        {canBookmark && (
          <div>
            <button
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={bookmark.isBookmarked}
              disabled={bookmark.pending}
              className={`${buttonStyle} ${bookmark.isBookmarked ? "text-accent border-accent/40" : "text-foreground-muted/60 border-border/20"}`}
              onClick={() => void bookmark.run()}
            >
              <ActionIcon action={bookmark.pending || bookmark.refreshFailed ? "refresh" : bookmark.isBookmarked ? "bookmarked" : "bookmark"} />
            </button>
          </div>
        )}
        {(controls?.error || bookmark.error) && (
          <div className="absolute right-0 top-10 flex w-64 max-w-[80vw] flex-col gap-2 rounded border border-border bg-surface p-2 text-xs">
            {controls?.error && <p role="alert">{controls.error}</p>}
            {bookmark.error && <p role="alert">{bookmark.error}</p>}
          </div>
        )}
      </div>
    );
  }
  return bounty.status === "open"
    ? <BountyHunt bounty={bounty}>{renderActions}</BountyHunt>
    : renderActions();
}

export default function BountyCardActions(props: Props) {
  const { user, loading } = useAuth();
  if (loading || !user || user.identity.osuUserId === props.bounty.creatorOsuUserId) return null;
  return <ConnectedActions key={`${user.identity.id}:${props.bounty.id}`} {...props} />;
}
