"use client";

import { useAuth } from "@/components/AuthProvider";
import { useParams, notFound } from "next/navigation";
import BountyActions, {
  type AvailableActions,
} from "@/components/bounty_details/BountyActions";
import BountyStatus from "@/components/bounty_details/BountyStatus";
import GoalCategory from "@/components/bounty_details/GoalCategory";
import ModsRequirement from "@/components/bounty_details/ModsRequirement";
import BeatmapRequirement from "@/components/bounty_details/BeatmapRequirement";
import { useBountyDetails } from "@/hooks/useBountyDetails";
import BountyCard, { BadgeLabel } from "@/components/bounty_views/BountyCard";
import { aes_font } from "@/lib/fonts";
import { InfoSection } from "@/components/bounty_details/InfoSection";

export default function BountyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { bounty, queryStatus, refreshBounty, refreshEngagement } = useBountyDetails(id);

  const { user } = useAuth();

  const isAuthenticated = user !== null;
  const isOpen = bounty?.status === "open";
  const isOwner = bounty?.creatorOsuUserId === user?.identity.osuUserId;
  const isBookmarked = bounty?.engagement.isBookmarkedByCurrentUser === true;

  const availableActions: AvailableActions = {
    canCancel: isAuthenticated && isOpen && isOwner,
    canHunt: isAuthenticated && !isOwner && isOpen,
    canBookmark: isAuthenticated && !isOwner && isOpen && !isBookmarked,
    canUnbookmark: isAuthenticated && !isOwner && isBookmarked,
  };

  if (queryStatus === "notFound") {
    return notFound();
  } else {
    return (
      <div className="flex w-full h-full place-content-center items-center pt-12 px-4">
        <div className="flex flex-col w-full max-w-2xl h-fit gap-4">
          {queryStatus === "complete" && bounty ? (
            <>
              <BountyCard bounty={bounty} />
              <BountyActions
                bounty={bounty}
                refresh={refreshBounty}
                refreshEngagement={refreshEngagement}
                availableActions={availableActions}
                isAuthenticated={isAuthenticated}
              />
              <div className="grid grid-cols-2 gap-4 mt-8">
                <InfoSection title="Status" className="col-span-full">
                  <div
                    className={`${aes_font.className} font-bold text-4xl w-full`}
                  >
                    <BountyStatus bounty={bounty} />
                  </div>
                </InfoSection>

                <InfoSection title="Engagement">
                  <div className="grid grid-cols-2 gap-4 h-full items-center">
                    <BadgeLabel
                      label="X players are currently hunting this bounty."
                      text="X players hunting"
                    />
                    <BadgeLabel
                      label="X players have bookmarked this bounty."
                      text="X bookmarks"
                    />
                  </div>
                </InfoSection>

                <InfoSection title="Goal">
                  <GoalCategory bounty={bounty} />
                </InfoSection>

                <InfoSection title="Beatmap" className="col-span-full">
                  <BeatmapRequirement bounty={bounty} />
                </InfoSection>

                <InfoSection title="Mods" className="col-span-full">
                  <ModsRequirement bounty={bounty} />
                </InfoSection>
              </div>
            </>
          ) : null}
          {queryStatus === "loading" ? <p>Loading bounty...</p> : null}
          {queryStatus === "errored" ? <p>Could not load bounty</p> : null}
        </div>
      </div>
    );
  }
}
