"use client";
import { AuthButton } from "@/components/AuthButton";
import {
  UserCard,
  MainSection,
  DailyClaim,
  LedgerEntries,
  PageSelector,
  EventHistory,
} from "@/components/UserProfile";
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
      <div className="size-full p-12 flex flex-col place-content-center items-center">
        <MainSection>
          <div className="w-full flex place-content-between pb-8 border-b border-slate-600">
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
          <div className="w-full flex flex-col items-center gap-8 pb-8 border-b border-slate-600">
            <h1 className="text-xl italic">Events history</h1>
            {eventsQueryStatus === "loading" ? <p>Loading...</p> : null}
            {eventsQueryStatus === "errored" ? (
              <div className="flex gap-2">
                <p>Error loading events</p>
                <button
                  className="cursor-pointer underline"
                  onClick={() => refreshEvents()}
                >
                  Retry
                </button>
              </div>
            ) : null}
            {eventsQueryStatus === "complete" && events ? (
              <div className="flex flex-col w-2/3 items-center">
                <EventHistory events={events} />
                <PageSelector
                  entriesLength={events.length}
                  pageSize={20}
                  selectedPage={eventsPage}
                  setSelectedPage={setEventsPage}
                />
              </div>
            ) : null}
          </div>

          {userIsPageOwner && ledgerQueryStatus === "loading" ? (
            <p>Loading...</p>
          ) : null}
          {userIsPageOwner && ledgerQueryStatus === "errored" ? (
            <div className="flex gap-2">
              <p>Error loading ledger</p>
              <button
                className="cursor-pointer underline"
                onClick={() => refreshLedger()}
              >
                Retry
              </button>
            </div>
          ) : null}
          {userIsPageOwner ? (
            <div className="w-full flex flex-col items-center gap-8 pb-8 border-b border-slate-600">
              <h1 className="text-xl italic">Transactions</h1>
              {ledgerQueryStatus === "complete" && ledgerEntries ? (
                <div className="flex flex-col w-2/3 items-center">
                  <LedgerEntries entries={ledgerEntries} />
                  <PageSelector
                    entriesLength={ledgerEntries.length}
                    pageSize={20}
                    selectedPage={ledgerPage}
                    setSelectedPage={setLedgerPage}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </MainSection>
      </div>
    );
  }
}
