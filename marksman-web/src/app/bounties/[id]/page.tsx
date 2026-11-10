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
import { InfoSection } from "@/components/ui/InfoSection";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";
import Button from "@/components/ui/Button";
import { useBountyView } from "@/hooks/useBountyView";
import UserStatsCardContainer from "@/components/users/UserStatsCard";
import StatContainer from "@/components/users/StatContainer";

export default function BountyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { view, setView } = useBountyView();
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
      <div className="flex flex-col w-full h-full place-content-center items-center py-12 px-4 gap-8">
        <PageHeaderBadge>Bounty Details</PageHeaderBadge>

        <div className="flex flex-col w-full max-w-2xl h-fit gap-4">
          {queryStatus === "complete" && bounty ? (
            <>
              <BountyStatus status={bounty.status} />
              <BountyCard bounty={bounty} />
              <BountyActions
                bounty={bounty}
                refresh={refreshBounty}
                refreshEngagement={refreshEngagement}
                availableActions={availableActions}
                isAuthenticated={isAuthenticated}
              />
              <div
                role="group"
                aria-label="Bounty views"
                className="flex w-full flex-col sm:flex-row justify-center items-center border-y border-border py-2 mt-4"
              >
                <Button
                  variant="textual"
                  size="md"
                  aria-pressed={view === "overview"}
                  onClick={() => setView("overview")}
                >
                  Overview
                </Button>
                <span
                  aria-hidden="true"
                  className="text-border hidden md:inline"
                >
                  •
                </span>
                <Button
                  variant="textual"
                  size="md"
                  aria-pressed={view === "engagement"}
                  onClick={() => setView("engagement")}
                >
                  Engagement
                </Button>
                <span
                  aria-hidden="true"
                  className="text-border hidden md:inline"
                >
                  •
                </span>
                <Button
                  variant="textual"
                  size="md"
                  aria-pressed={view === "comments"}
                  onClick={() => setView("comments")}
                >
                  Comments
                </Button>
              </div>
              {view === "overview" ? (
                <div className="grid grid-cols-2 gap-4">
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
              ) : view === "engagement" ? (
                <div className="grid grid-cols-2 w-full gap-4">
                  <UserStatsCardContainer cols={1} size="lg">
                    <StatContainer
                      stat={0}
                      title="Ongoing Hunts"
                      unit="count"
                      disabled
                    />
                  </UserStatsCardContainer>
                  <UserStatsCardContainer cols={1} size="lg">
                    <StatContainer
                      stat={bounty.engagement.bookmarkCount}
                      title={
                        bounty.engagement.bookmarkCount > 1
                          ? "Bookmarks"
                          : "Bookmark"
                      }
                      unit="count"
                    />
                  </UserStatsCardContainer>
                </div>
              ) : (
                <InfoSection title="Comments">
                  <p>Comments coming soon.</p>
                </InfoSection>
              )}
            </>
          ) : null}
          {queryStatus === "loading" ? <p>Loading bounty...</p> : null}
          {queryStatus === "errored" ? <p>Could not load bounty</p> : null}
        </div>
      </div>
    );
  }
}
