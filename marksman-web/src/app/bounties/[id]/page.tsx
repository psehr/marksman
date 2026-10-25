"use client";

import { useAuth } from "@/components/AuthProvider";
import Bounty from "@/components/Bounty";
import BountyHunt from "@/components/BountyHunt";
import { useParams, notFound } from "next/navigation";
import { ReactNode } from "react";
import BountyActions, {
  AvailableActions,
} from "@/components/bounty_details/BountyActions";
import BountyStatus from "@/components/bounty_details/BountyStatus";
import GoalCategory from "@/components/bounty_details/GoalCategory";
import ModsRequirement from "@/components/bounty_details/ModsRequirement";
import BeatmapRequirement from "@/components/bounty_details/BeatmapRequirement";
import { useBountyDetails } from "@/hooks/useBountyDetails";
import BountyCard from "@/components/bounty_views/BountyCard";

export function InfoSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-600 bg-blue-950 p-4 gap-4 text-center items-center">
      <h2 className="text-xl underline underline-offset-4">{title}</h2>
      {children}
    </section>
  );
}

export default function BountyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { bounty, queryStatus, refreshBounty } = useBountyDetails(id);

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
        <div className="flex flex-col w-full max-w-2xl h-fit gap-12">
          {queryStatus === "complete" && bounty ? (
            <>
              <BountyCard bounty={bounty} />
              <div className="grid grid-cols-2 gap-4">
                <InfoSection title="Current Status">
                  <BountyStatus bounty={bounty} />
                </InfoSection>
                <InfoSection title="Actions">
                  <BountyActions
                    bounty={bounty}
                    refresh={refreshBounty}
                    availableActions={availableActions}
                    isAuthenticated={isAuthenticated}
                  />
                </InfoSection>
                <InfoSection title="Goal">
                  <GoalCategory bounty={bounty} />
                </InfoSection>
                <InfoSection title="Mods">
                  <ModsRequirement bounty={bounty} />
                </InfoSection>
                <div className="col-span-full">
                  <InfoSection title="Beatmap">
                    <BeatmapRequirement bounty={bounty} />
                  </InfoSection>
                </div>

                {availableActions.canHunt ? (
                  <div className="col-span-full">
                    <InfoSection title="Hunting">
                      <BountyHunt bounty={bounty} />
                    </InfoSection>
                  </div>
                ) : null}
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
