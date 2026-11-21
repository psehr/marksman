import CopyText from "@/components/ui/CopyText";
import { ExtendedBounty } from "@marksman/contracts";
import { ReactNode } from "react";

type ContextualStatus =
  | "open"
  | "hunting"
  | "completed"
  | "won_by_user"
  | "cancelled"
  | "owned"
  | "none";

export default function BountyStatusDescriptor({
  bounty,
  osuUserId,
  isHunting,
}: {
  bounty: ExtendedBounty;
  isHunting: boolean;
  osuUserId?: number;
}) {
  let context: ContextualStatus;
  let content: ReactNode;

  const shareAchievementMessage = () => {
    const owner = bounty.owner?.username;
    const bountyUrl = new URL(`/bounties/${bounty.id}`, window.location.origin)
      .href;
    const profileLink = bounty.winner
      ? ` - [Profile](<${
          new URL(`/users/${bounty.winner.id}`, window.location.origin).href
        }>)`
      : "";

    return `✅ I completed a bounty from *${owner ?? "another player"}* and won **${bounty.rewardBp} BP**! ✅
  **[View Bounty](<${bountyUrl}>)${profileLink}**
  Start hunting bounties now on **[marksman.psehr.dev](<https://marksman.psehr.dev>)**! 🎯`;
  };

  if (bounty.status === "completed") {
    context =
      osuUserId != null && bounty.completedByOsuUserId === osuUserId
        ? "won_by_user"
        : "completed";
  } else if (bounty.status === "cancelled") {
    context = "cancelled";
  } else if (bounty.status === "open") {
    context =
      osuUserId != null && bounty.creatorOsuUserId === osuUserId
        ? "owned"
        : isHunting
          ? "hunting"
          : "open";
  } else {
    context = "none";
  }

  switch (context) {
    case "open":
      content = (
        <>
          <p role="status" className="text-sm text-accent text-center">
            This bounty is open for completion.
          </p>
          <p
            role="status"
            className="text-xs text-foreground-muted text-center"
          >
            Start hunting it to track your future scores.
          </p>
        </>
      );
      break;
    case "hunting":
      content = (
        <>
          <p role="status" className="text-sm text-accent text-center">
            You are currently hunting this bounty.
          </p>
          <p
            role="status"
            className="text-xs text-foreground-muted text-center"
          >
            Marksman tracks your submitted scores on this beatmap.
          </p>
        </>
      );
      break;
    case "completed":
      content = (
        <>
          <p role="status" className="text-sm text-accent text-center">
            This bounty has been completed by a player.
          </p>
          <p
            role="status"
            className="text-xs text-foreground-muted text-center"
          >
            It can no longer be hunted for completion.
          </p>
        </>
      );
      break;
    case "won_by_user":
      content = (
        <>
          <p role="status" className="text-sm text-accent text-center">
            You completed this bounty! 🥳
          </p>
          <CopyText
            text={shareAchievementMessage}
            label="Share achievement"
            size="sm"
            variant="textual"
          />
        </>
      );
      break;
    case "cancelled":
      content = (
        <>
          <p role="status" className="text-sm text-accent text-center">
            This bounty has been cancelled by its creator.
          </p>
          <p
            role="status"
            className="text-xs text-foreground-muted text-center"
          >
            It can no longer be hunted for completion.
          </p>
        </>
      );
      break;
    case "owned":
      content = (
        <>
          <p role="status" className="text-sm text-accent text-center">
            You own this bounty.
          </p>
          <p
            role="status"
            className="text-xs text-foreground-muted text-center"
          >
            Other players can hunt it for completion.
          </p>
        </>
      );
      break;
    case "none":
      return null;
  }
  return <div className="flex flex-col gap-1">{content}</div>;
}
