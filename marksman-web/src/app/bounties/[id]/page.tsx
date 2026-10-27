"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useParams, notFound } from "next/navigation";
import BountyActions, {
  type AvailableActions,
} from "@/components/bounties/details/BountyActions";
import BountyStatus from "@/components/bounties/details/BountyStatus";
import GoalCategory from "@/components/bounties/details/GoalCategory";
import ModsRequirement from "@/components/bounties/details/ModsRequirement";
import BeatmapRequirement from "@/components/bounties/details/BeatmapRequirement";
import { useBountyDetails } from "@/hooks/useBountyDetails";
import BountyCard from "@/components/bounties/BountyCard";
import { aes_font } from "@/lib/fonts";
import { InfoSection } from "@/components/ui/InfoSection";
import { BadgeLabel } from "@/components/ui/BadgeLabel";

export default function BountyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { bounty, queryStatus, refreshBounty, refreshEngagement } =
    useBountyDetails(id);

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
      <div className="flex w-full h-full place-content-center items-center py-12 px-4">
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
                <InfoSection title="Status">
                  <div
                    className={`${aes_font.className} font-bold text-4xl w-full`}
                  >
                    <BountyStatus bounty={bounty} />
                  </div>
                </InfoSection>

                <InfoSection title="Engagement">
                  <div
                    className={`flex flex-col gap-2 items-center ${aes_font.className} font-bold`}
                  >
                    <p>
                      <span className="text-accent font-bold">X</span> player(s)
                      are hunting
                    </p>
                    <p>
                      <span className="text-accent font-bold">
                        {bounty.engagement.bookmarkCount}
                      </span>{" "}
                      user(s) have bookmarked
                    </p>
                  </div>
                </InfoSection>

                <InfoSection title="Goal">
                  <GoalCategory bounty={bounty} />
                </InfoSection>

                <InfoSection title="Mods">
                  <ModsRequirement bounty={bounty} />
                </InfoSection>

                <InfoSection title="Beatmap" className="col-span-full">
                  <BeatmapRequirement bounty={bounty} />
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
