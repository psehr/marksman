"use client";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/components/AuthProvider";
import { BountyEvent, LedgerEntry, User } from "@marksman/contracts";
import { formatDistance } from "date-fns";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";

function UserCard({ user }: { user: User }) {
  return (
    <div className="size-fit px-4 p-2 border border-slate-600 rounded bg-black/30 text-xl">
      <Link
        className="font-bold underline underline-offset-2"
        href={`https://osu.ppy.sh/users/${user.identity.osuUserId}`}
      >
        {user.identity.username}
      </Link>
      <p>Balance: {user.stats.bpBalance} BP</p>
    </div>
  );
}

function MainSection({ children }: { children: ReactNode }) {
  return (
    <div className="w-1/2 h-screen bg-blue-950 rounded shadow-md border border-slate-600 flex flex-col items-center gap-8 p-8">
      {children}
    </div>
  );
}

function DailyClaim({
  claimed,
  claimPending,
  claimMessage,
  claimError,
  claimDailyReward,
}: {
  claimed: boolean;
  claimPending: boolean;
  claimMessage: string | null;
  claimError: string | null;
  claimDailyReward: () => void;
}) {
  return (
    <div className="text-right">
      <button
        type="button"
        className="px-4 p-2 bg-yellow-500/50 cursor-pointer rounded disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={claimPending || claimed}
        onClick={() => void claimDailyReward()}
      >
        {claimPending
          ? "Claiming…"
          : claimed
            ? "Daily BP claimed"
            : "Claim daily 25 BP"}
      </button>
      {claimMessage ? <p role="status">{claimMessage}</p> : null}
      {claimError ? <p role="alert">{claimError}</p> : null}
    </div>
  );
}

function LedgerEntries({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) return <p>[No transactions to show]</p>;

  return (
    <table className="w-full text-left">
      <caption className="sr-only">BP transaction history</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Activity</th>
          <th scope="col">BP</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          let color =
            entry.amount > 0
              ? "border-green-400/30 bg-green-400/10 text-green-200"
              : "border-red-400/30 bg-red-400/10 text-red-200";

          let reason_text;

          switch (entry.reason) {
            case "bounty_funding":
              reason_text = "Bounty Funding";
              break;
            case "bounty_refund":
              reason_text = "Bounty Cancellation";
              break;
            case "bounty_fee":
              reason_text = "Bounty Funding Fee";
              break;
            case "bounty_reward":
              reason_text = "Bounty Reward";
              break;
            case "daily_claim":
              reason_text = "Daily Claim";
              break;
            case "initial_grant":
              reason_text = "Account Creation";
              break;
          }
          return (
            <tr key={entry.id} className={`text-sm ${color}`}>
              <td>
                <p>{formatDistance(Date.now(), entry.createdAt)} ago</p>
              </td>
              <td>
                {entry.bountyId ? (
                  <Link
                    href={"/bounties/" + entry.bountyId}
                    className="underline"
                  >
                    {reason_text}↗
                  </Link>
                ) : (
                  reason_text
                )}
              </td>
              <td>
                {entry.amount > 0 ? "+" : ""}
                {entry.amount}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PageSelector({
  entriesLength,
  pageSize,
  selectedPage,
  setSelectedPage,
}: {
  entriesLength: number;
  pageSize: number;
  selectedPage: number;
  setSelectedPage: (page: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {selectedPage > 1 ? (
        <button
          className="cursor-pointer"
          onClick={() => {
            setSelectedPage(selectedPage - 1);
          }}
        >
          {"<"}
        </button>
      ) : (
        "-"
      )}
      <p>Page {selectedPage}</p>
      {entriesLength < pageSize ? (
        "-"
      ) : (
        <button
          className="cursor-pointer"
          onClick={() => {
            setSelectedPage(selectedPage + 1);
          }}
        >
          {">"}
        </button>
      )}
    </div>
  );
}

function EventHistory({ events }: { events: BountyEvent[] }) {
  if (!events.length) return <p>[No events to show]</p>;

  return (
    <table className="w-full text-left">
      <caption className="sr-only">Bounty Events History</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Event</th>
          <th scope="col">Bounty</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => {
          let color;

          switch (event.type) {
            case "created":
              color = "border-blue-400/30 bg-blue-400/10 text-blue-200";
              break;
            case "completed":
              color = "border-green-400/30 bg-green-400/10 text-green-200";
              break;
            case "cancelled":
              color = "border-red-400/30 bg-red-400/10 text-red-200";
              break;
          }

          return (
            <tr
              key={event.bountyId + event.type}
              className={`${color} text-sm`}
            >
              <td>
                <p>{formatDistance(Date.now(), event.timestamp)} ago</p>
              </td>
              <td>
                {event.type === "created" ? <p>Funded a new bounty</p> : null}
                {event.type === "completed" ? (
                  <p>
                    {event.winner?.username ?? "Unknown user"} completed{" "}
                    {event.creator?.username ?? "Unknown user"}
                    's bounty
                  </p>
                ) : null}
                {event.type === "cancelled" ? <p>Cancelled a bounty</p> : null}
              </td>
              <td>
                <Link
                  href={`/bounties/${event.bountyId}`}
                  className="underline"
                >
                  Link
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const { user, refreshUser: refreshAccount } = useAuth();

  const [userQueryStatus, setUserQueryStatus] = useState<
    "loading" | "errored" | "complete" | "notFound"
  >("loading");
  const [detailedUser, setDetailedUser] = useState<User>();

  const [ledgerQueryStatus, setLedgerQueryStatus] = useState<
    "loading" | "errored" | "complete"
  >("loading");
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>();
  const [ledgerPage, setLedgerPage] = useState(1);

  const [eventsQueryStatus, setEventsQueryStatus] = useState<
    "loading" | "errored" | "complete"
  >("loading");
  const [events, setEvents] = useState<BountyEvent[]>();
  const [eventsPage, setEventsPage] = useState(1);

  const [userRefresh, setUserRefresh] = useState(0);
  const [ledgerRefresh, setLedgerRefresh] = useState(0);
  const [eventsRefresh, setEventsRefresh] = useState(0);

  const [claimPending, setClaimPending] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const claimRequest = useRef({ active: true, pending: false });

  const userIsPageOwner = Boolean(
    user && user.identity.id === id && detailedUser?.identity.id === id,
  );

  useEffect(() => {
    const request = { active: true, pending: false };
    claimRequest.current = request;
    setClaimPending(false);
    setClaimed(false);
    setClaimMessage(null);
    setClaimError(null);

    setLedgerEntries([]);
    setLedgerPage(1);

    return () => {
      request.active = false;
    };
  }, [id, user?.identity.id]);

  useEffect(() => {
    setEvents([]);
    setEventsPage(1);
  }, [id]);

  const refreshUser = () => {
    setUserRefresh((previous) => previous + 1);
  };

  const refreshLedger = () => {
    setLedgerRefresh((previous) => previous + 1);
  };

  const refreshEvents = () => {
    setEventsRefresh((previous) => previous + 1);
  };

  async function claimDailyReward() {
    const request = claimRequest.current;
    if (!userIsPageOwner || request.pending || claimed) return;

    request.pending = true;
    setClaimPending(true);
    setClaimMessage(null);
    setClaimError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/economy/daily-claim`,
        { method: "POST", credentials: "include" },
      );
      if (!request.active) return;

      if (response.ok) {
        setClaimed(true);
        setClaimMessage("Claimed 25 BP.");
        refreshUser();
        refreshLedger();
        setLedgerPage(1);
        await refreshAccount();
      } else if (response.status === 409) {
        setClaimed(true);
        setClaimMessage(
          "Already claimed today. Daily rewards reset at 00:00 UTC.",
        );
      } else {
        const data = await response.json().catch(() => null);
        if (request.active) {
          setClaimError(
            typeof data?.error === "string"
              ? data.error
              : `Daily claim failed (${response.status}). Please try again.`,
          );
        }
      }
    } catch {
      if (request.active) {
        setClaimError("Could not claim the daily reward. Please try again.");
      }
    } finally {
      request.pending = false;
      if (request.active) setClaimPending(false);
    }
  }

  // USER LOOKUP EFFECT
  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      try {
        setUserQueryStatus("loading");

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/${id}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (response.ok) {
          const fetchedUser: User = await response.json();

          if (!ignore) {
            setDetailedUser(fetchedUser);

            setUserQueryStatus("complete");
          }
        } else {
          if (!ignore) {
            if (response.status === 404 || response.status === 400) {
              setUserQueryStatus("notFound");
            } else {
              setUserQueryStatus("errored");
            }
          }
        }
      } catch {
        if (!ignore) setUserQueryStatus("errored");
      }
    }

    void loadUser();

    return () => {
      ignore = true;
    };
  }, [userRefresh, id]);

  // USER LEDGER LOOKUP EFFECT
  useEffect(() => {
    if (userQueryStatus === "complete" && detailedUser && userIsPageOwner) {
      let ignore = false;

      async function loadLedger() {
        try {
          setLedgerQueryStatus("loading");

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/users/me/ledger?page=${ledgerPage}`,

            {
              credentials: "include",
              cache: "no-store",
            },
          );

          if (response.ok) {
            const fetchedEntries: LedgerEntry[] = await response.json();

            if (!ignore) {
              setLedgerEntries(fetchedEntries);

              setLedgerQueryStatus("complete");
            }
          } else {
            if (!ignore) setLedgerQueryStatus("errored");
          }
        } catch {
          if (!ignore) setLedgerQueryStatus("errored");
        }
      }

      void loadLedger();

      return () => {
        ignore = true;
      };
    }
  }, [
    ledgerRefresh,
    ledgerPage,
    detailedUser?.identity,
    id,
    userQueryStatus,
    userIsPageOwner,
  ]);

  // USER EVENTS LOOKUP EFFECT
  useEffect(() => {
    if (
      userQueryStatus === "complete" &&
      detailedUser &&
      detailedUser.identity.id === id
    ) {
      let ignore = false;

      async function loadEvents() {
        try {
          setEventsQueryStatus("loading");

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/users/${detailedUser?.identity.id}/bounty-events?page=${eventsPage}`,
            {
              credentials: "include",
              cache: "no-store",
            },
          );
          if (response.ok) {
            const fetchedEvents: BountyEvent[] = await response.json();

            if (!ignore) {
              setEvents(fetchedEvents);

              setEventsQueryStatus("complete");
            }
          } else {
            if (!ignore) setEventsQueryStatus("errored");
          }
        } catch {
          if (!ignore) setEventsQueryStatus("errored");
        }
      }

      void loadEvents();

      return () => {
        ignore = true;
      };
    }
  }, [eventsRefresh, eventsPage, id, detailedUser?.identity, userQueryStatus]);

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
