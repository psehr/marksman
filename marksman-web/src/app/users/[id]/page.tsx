"use client";
import { AuthButton } from "@/components/auth/AuthButton";
import Button from "@/components/ui/Button";
import { InfoSection } from "@/components/ui/InfoSection";
import PageHeaderBadge from "@/components/ui/PageHeaderBadge";
import { DailyClaim } from "@/components/users/DailyClaim";
import { EventHistory } from "@/components/users/EventHistory";
import { LedgerEntries } from "@/components/users/LedgerEntries";
import { MainSection } from "@/components/users/MainSection";
import { PageSelector } from "@/components/users/PageSelector";
import { UserCard } from "@/components/users/UserCard";
import { useUserProfile } from "@/hooks/useUserProfile";
import { aes_font } from "@/lib/fonts";
import { PROFILE_HISTORY_PAGE_SIZE } from "@marksman/contracts";
import { notFound, useParams } from "next/navigation";
import ProfileBountySlots from "@/components/users/ProfileBountySlots";
import { Suspense } from "react";

export default function UserPage() {
  return (
    <Suspense fallback={<p>Loading profile...</p>}>
      <UserProfile />
    </Suspense>
  );
}

function UserProfile() {
  const { id } = useParams<{ id: string }>();

  const {
    user,
    detailedUser,
    userQueryStatus,
    userIsPageOwner,
    ledgerEntries,
    ledgerQueryStatus,
    ledgerPage,
    setLedgerPage,
    refreshLedger,
    events,
    eventsQueryStatus,
    eventsPage,
    setEventsPage,
    refreshEvents,
    claimed,
    claimPending,
    claimMessage,
    claimError,
    claimDailyReward,
    hunts,
    refreshHunts,
    huntsQueryStatus,
    view,
    setView,
  } = useUserProfile(id);

  if (userQueryStatus === "loading") {
    return (
      <div className="flex size-full place-content-center items-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (userQueryStatus === "notFound") {
    return notFound();
  }

  if (userQueryStatus === "errored") {
    return (
      <div className="flex size-full place-content-center items-center">
        <p>500 Internal Error</p>
      </div>
    );
  }

  if (userQueryStatus === "complete" && detailedUser) {
    let content;
    switch (view) {
      case "activity":
        content = (
          <>
            <InfoSection
              title="Activity"
              className="min-w-0 h-96"
              contentClassName="flex min-h-0 flex-1 flex-col p-4"
            >
              {eventsQueryStatus === "loading" ? <p>Loading...</p> : null}
              {eventsQueryStatus === "errored" ? (
                <div className="flex gap-2">
                  <p>Error loading events</p>
                  <Button size="sm" onClick={() => refreshEvents()}>
                    Retry
                  </Button>
                </div>
              ) : null}
              {eventsQueryStatus === "complete" && events ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <EventHistory events={events} />
                  <div className="shrink-0 self-center">
                    <PageSelector
                      entriesLength={events.length}
                      pageSize={PROFILE_HISTORY_PAGE_SIZE}
                      selectedPage={eventsPage}
                      setSelectedPage={setEventsPage}
                    />
                  </div>
                </div>
              ) : null}
            </InfoSection>

            {userIsPageOwner ? (
              <InfoSection
                title="Transactions"
                className="min-w-0 h-96"
                contentClassName="flex min-h-0 flex-1 flex-col p-4"
              >
                {userIsPageOwner && ledgerQueryStatus === "loading" ? (
                  <p>Loading...</p>
                ) : null}
                {userIsPageOwner && ledgerQueryStatus === "errored" ? (
                  <div className="flex gap-2">
                    <p>Error loading ledger</p>
                    <Button size="sm" onClick={() => refreshLedger()}>
                      Retry
                    </Button>
                  </div>
                ) : null}
                {userIsPageOwner &&
                ledgerQueryStatus === "complete" &&
                ledgerEntries ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-4">
                    <LedgerEntries entries={ledgerEntries} />
                    <div className="shrink-0 self-center">
                      <PageSelector
                        entriesLength={ledgerEntries.length}
                        pageSize={PROFILE_HISTORY_PAGE_SIZE}
                        selectedPage={ledgerPage}
                        setSelectedPage={setLedgerPage}
                      />
                    </div>
                  </div>
                ) : null}
              </InfoSection>
            ) : null}
          </>
        );
        break;
      case "hunting":
        content = (
          <div className="flex flex-col lg:flex-row place-content-center items-stretch col-span-full gap-4">
            {huntsQueryStatus === "complete" ? (
              <ProfileBountySlots hunts={hunts} />
            ) : null}
            {huntsQueryStatus === "loading" ? <p>Loading hunts...</p> : null}
            {huntsQueryStatus === "errored" ? (
              <>
                <p>Error loading hunts</p>
                <Button size="sm" onClick={refreshHunts}>
                  Retry
                </Button>
              </>
            ) : null}
          </div>
        );
        break;
      case "created":
        content = (
          <InfoSection title="W.I.P" className="col-span-full">
            This page is still work in progress. It is not available yet.
          </InfoSection>
        );
        break;
    }

    return (
      <div className="w-full py-12 px-4 gap-8 flex flex-col place-content-center items-center">
        <PageHeaderBadge>Marksman Profile</PageHeaderBadge>
        <MainSection>
          <div className="w-full">
            <div className="w-full flex flex-col sm:flex-row justify-between gap-4 pb-8 border-b border-border">
              <UserCard user={detailedUser} />
              <div className="flex flex-col place-content-end gap-2">
                {userIsPageOwner ? (
                  <DailyClaim
                    claimed={claimed}
                    claimPending={claimPending}
                    claimMessage={claimMessage}
                    claimError={claimError}
                    claimDailyReward={claimDailyReward}
                  />
                ) : null}
                {user ? <AuthButton /> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="textual"
              aria-pressed={view === "hunting"}
              onClick={() => setView("hunting")}
            >
              Hunting
            </Button>
            <span className="text-border hidden md:inline">•</span>
            <Button
              variant="textual"
              aria-pressed={view === "created"}
              onClick={() => setView("created")}
            >
              Created Bounties
            </Button>
            <span className="text-border hidden md:inline">•</span>
            <Button
              variant="textual"
              aria-pressed={view === "activity"}
              onClick={() => setView("activity")}
            >
              Activity
            </Button>
          </div>
          <div
            className={`w-full grid grid-cols-1 gap-4 ${userIsPageOwner ? "lg:grid-cols-2" : ""}`}
          >
            {content}
          </div>
        </MainSection>
      </div>
    );
  }
}
