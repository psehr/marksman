"use client";

import { useAuth } from "@/components/AuthProvider";
import Bounty, { renderMods } from "@/components/Bounty";
import CancelBountyButton from "@/components/buttons/CancelBounty";
import BookmarkBountyButton from "@/components/buttons/BookmarkBounty";
import LoginButton from "@/components/buttons/Login";
import ClaimWizard from "@/components/ClaimWizard";
import { ExtendedBounty } from "@marksman/contracts";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type AvailableActions = {
  canCancel: boolean;
  canClaim: boolean;
  canBookmark: boolean;
  canUnbookmark: boolean;
};

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

function displayBeatmapRequirement(bounty: ExtendedBounty) {
  const mapUrl = `https://osu.ppy.sh/beatmaps/${bounty?.goal.beatmapId}`;

  return (
    <>
      {bounty.beatmap && bounty.beatmap.song && bounty.beatmap.specs ? (
        <div className="flex flex-row gap-2 place-content-center">
          <p>Score must be set on</p>
          <p className="italic font-bold truncate max-w-2/3">
            {bounty.beatmap.song.artist} - {bounty.beatmap.song.title} [
            {bounty.beatmap.version.name}]
          </p>
          <p>({bounty.beatmap.specs.sr.toFixed(2)}★)</p>
        </div>
      ) : (
        <p>Unavailable beatmap metadata</p>
      )}

      <Link href={mapUrl} className="bg-sky-700 px-4 py-2 rounded w-fit">
        osu! Beatmap Page
      </Link>
    </>
  );
}

function displayGoal(bounty: ExtendedBounty) {
  return (
    <>
      {bounty.goal.type === "full_combo" ? (
        <p>A full-combo is required</p>
      ) : null}
      {bounty.goal.type === "minimum_grade" ? (
        <p>
          A minimum grade of {bounty.goal.minimumGradeRequirement} is required
        </p>
      ) : null}
      {bounty.goal.minimumAccuracy !== undefined ? (
        <p>
          A minimum accuracy of {bounty.goal.minimumAccuracy}% must be achieved
        </p>
      ) : null}
    </>
  );
}

function displayMods(bounty: ExtendedBounty) {
  return (
    <>
      {bounty.goal.modRequirement.rule === "any" ? (
        <p>Any mod combination can be used for completion</p>
      ) : null}
      {bounty.goal.modRequirement.rule === "exact" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Used mods must be </p>
            <p className="text-yellow-200">exactly</p>
            <p>the following:</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "lg")}</div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "includes" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Used mods must </p>
            <p className="text-blue-300">include</p>
            <p>the following:</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "lg")}</div>
        </div>
      ) : null}
      {bounty.goal.modRequirement.rule === "excludes" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            <p>Some mods must be</p>
            <p className="text-red-300">excluded</p>
            <p>to qualify</p>
          </div>
          <div className="flex gap-1">{renderMods(bounty, "lg")}</div>
        </div>
      ) : null}
    </>
  );
}

function displayStatus(bounty: ExtendedBounty) {
  switch (bounty.status) {
    case "open":
      return (
        <div className="grid grid-cols-2 w-full">
          <section className="flex w-full place-content-center">
            <p className="w-fit text-2xl font-bold bg-green-400/30 border border-dashed py-2 px-8 rounded">
              OPEN
            </p>
          </section>
          <section className="flex w-full place-content-center items-center">
            <p className="w-fit">
              {bounty.engagement.bookmarkCount} player(s) bookmarked
            </p>
          </section>
        </div>
      );
    case "completed":
      return (
        <div className="flex w-full place-content-center">
          <p className="w-fit text-2xl font-bold bg-blue-400/30 border border-dashed py-2 px-8 rounded">
            COMPLETED
          </p>
        </div>
      );
    case "cancelled":
      return (
        <div className="flex w-full place-content-center">
          <p className="w-fit text-2xl font-bold bg-red-400/30 border border-dashed py-2 px-8 rounded">
            CANCELLED
          </p>
        </div>
      );
  }
}

function displayActions(
  bounty: ExtendedBounty,
  refresh: () => void,
  availableActions: AvailableActions,
  isAuthenticated: boolean,
) {
  const displayAvailableActions =
    availableActions.canCancel ||
    availableActions.canBookmark ||
    availableActions.canUnbookmark;

  if (!isAuthenticated) return <LoginButton />;
  if (!displayAvailableActions)
    return <p className="text-sm">There are currently no available actions</p>;

  return (
    <div className="flex gap-2">
      {availableActions.canCancel ? (
        <CancelBountyButton bounty={bounty} refresh={refresh} />
      ) : null}
      {availableActions.canBookmark || availableActions.canUnbookmark ? (
        <BookmarkBountyButton bounty={bounty} refresh={refresh} />
      ) : null}
    </div>
  );
}

export default function BountyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [queryStatus, setQueryStatus] = useState<
    "loading" | "errored" | "complete" | "notFound"
  >("loading");
  const [bounty, setBounty] = useState<ExtendedBounty>();

  const [refresh, setRefresh] = useState(0);

  const refreshBounty = () => {
    setRefresh((previous) => previous + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function loadBounty() {
      try {
        setQueryStatus("loading");
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bounties/${id}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (response.ok) {
          const bounty: ExtendedBounty = await response.json();

          if (!ignore) {
            setBounty(bounty);

            setQueryStatus("complete");
          }
        } else {
          if (!ignore) {
            if (response.status === 404 || response.status === 400) {
              setQueryStatus("notFound");
            } else {
              setQueryStatus("errored");
            }
          }
        }
      } catch {
        if (!ignore) setQueryStatus("errored");
      }
    }

    void loadBounty();

    return () => {
      ignore = true;
    };
  }, [refresh, id, user?.identity.id]);

  const isAuthenticated = user !== null;
  const isOpen = bounty?.status === "open";
  const isOwner = bounty?.creatorOsuUserId === user?.identity.osuUserId;
  const isBookmarked = bounty?.engagement.isBookmarkedByCurrentUser === true;

  const availableActions: AvailableActions = {
    canCancel: isAuthenticated && isOpen && isOwner,
    canClaim: isAuthenticated && !isOwner && isOpen,
    canBookmark: isAuthenticated && !isOwner && isOpen && !isBookmarked,
    canUnbookmark: isAuthenticated && !isOwner && isBookmarked,
  };

  const [selectedScoreId, setSelectedScoreId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedScoreId(null);
  }, [id, user?.identity.id]);

  if (queryStatus === "notFound") {
    return notFound();
  } else {
    return (
      <div className="flex w-full h-full place-content-center items-center p-12">
        <div className="flex flex-col w-3/5 h-fit gap-12">
          {queryStatus === "complete" && bounty ? (
            <>
              <Bounty bounty={bounty} />
              <div className="grid grid-cols-2 gap-4">
                <InfoSection title="Current Status">
                  {displayStatus(bounty)}
                </InfoSection>
                <InfoSection title="Actions">
                  {displayActions(
                    bounty,
                    refreshBounty,
                    availableActions,
                    isAuthenticated,
                  )}
                </InfoSection>
                <InfoSection title="Goal">{displayGoal(bounty)}</InfoSection>
                <InfoSection title="Mods">{displayMods(bounty)}</InfoSection>
                <div className="col-span-full">
                  <InfoSection title="Beatmap">
                    {displayBeatmapRequirement(bounty)}
                  </InfoSection>
                </div>

                {availableActions.canClaim ? (
                  <div className="col-span-full">
                    <InfoSection title="Claim Wizard">
                      <ClaimWizard
                        bounty={bounty}
                        selectedScoreId={selectedScoreId}
                        setSelectedScoreId={setSelectedScoreId}
                        refresh={refreshBounty}
                      />
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
