"use client";
import { PROFILE_HISTORY_PAGE_SIZE } from "@marksman/contracts";
import { AuthButton } from "@/components/auth/AuthButton";
import Button from "@/components/ui/Button";
import { InfoSection } from "@/components/ui/InfoSection";
import {
  UserCard,
  MainSection,
  DailyClaim,
  LedgerEntries,
  PageSelector,
  EventHistory,
} from "@/components/users/UserProfile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { notFound, useParams } from "next/navigation";

export default function UserPage() {
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
    return (
      <div className="w-full py-12 px-4 flex flex-col place-content-center items-center">
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
          <div
            className={`w-full grid grid-cols-1 gap-4 ${userIsPageOwner ? "lg:grid-cols-2" : ""}`}
          >
            <InfoSection
              title="Events"
              className="min-w-0"
              contentClassName="min-w-0 flex-1 p-4"
            >
              {eventsQueryStatus === "loading" ? <p>Loading...</p> : null}
              {eventsQueryStatus === "errored" ? (
                <div className="flex gap-2">
                  <p>Error loading events</p>
                  <Button
                    size="sm"
                    onClick={() => refreshEvents()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
              {eventsQueryStatus === "complete" && events ? (
                <div className="flex flex-col w-full min-w-0 items-center gap-4">
                  <EventHistory events={events} />
                  <PageSelector
                    entriesLength={events.length}
                    pageSize={PROFILE_HISTORY_PAGE_SIZE}
                    selectedPage={eventsPage}
                    setSelectedPage={setEventsPage}
                  />
                </div>
              ) : null}
            </InfoSection>

            {userIsPageOwner ? (
              <InfoSection
                title="Transactions"
                className="min-w-0"
                contentClassName="min-w-0 flex-1 p-4"
              >
                {userIsPageOwner && ledgerQueryStatus === "loading" ? (
                  <p>Loading...</p>
                ) : null}
                {userIsPageOwner && ledgerQueryStatus === "errored" ? (
                  <div className="flex gap-2">
                    <p>Error loading ledger</p>
                    <Button
                      size="sm"
                      onClick={() => refreshLedger()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}
                {userIsPageOwner &&
                ledgerQueryStatus === "complete" &&
                ledgerEntries ? (
                  <div className="flex flex-col w-full min-w-0 items-center gap-4">
                    <LedgerEntries entries={ledgerEntries} />
                    <PageSelector
                      entriesLength={ledgerEntries.length}
                      pageSize={PROFILE_HISTORY_PAGE_SIZE}
                      selectedPage={ledgerPage}
                      setSelectedPage={setLedgerPage}
                    />
                  </div>
                ) : null}
              </InfoSection>
            ) : null}
          </div>
        </MainSection>
      </div>
    );
  }
}
