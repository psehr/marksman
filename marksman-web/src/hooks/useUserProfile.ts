import { useAuth } from "@/components/auth/AuthProvider";
import { getUser, getUserLedger, getUserBountyEvents } from "@/lib/api/users";
import { claimDailyBp, getDailyClaimStatus } from "@/lib/api/economy";
import { ApiError } from "@/lib/api/client";
import type {
  BountyEvent,
  BountySearchQuery,
  DetailedUser,
  LedgerEntry,
} from "@marksman/contracts";
import { useEffect, useRef, useState } from "react";
import { useUserHunts } from "./useUserHunts";
import { useProfileView } from "./useProfileView";
import { useUserCreatedBounties } from "./useUserCreatedBounties";
import { useUserWonBounties } from "./useUserWonBounties";

export function useUserProfile(id: string) {
  const { view, setView } = useProfileView();
  const { user, refreshUser: refreshAccount } = useAuth();
  const { hunts, huntsQueryStatus, refreshHunts } = useUserHunts(id);
  const [createdQuery, setCreatedQuery] = useState<{
    creatorId: string;
    status: BountySearchQuery["status"];
    page: number;
  }>({ creatorId: id, status: "open", page: 1 });
  const [wonQuery, setWonQuery] = useState<{ winnerId: string; page: number }>({
    winnerId: id,
    page: 1,
  });
  // Use defaults immediately on profile navigation, before any new request runs.
  const createdBountiesStatus =
    createdQuery.creatorId === id ? createdQuery.status : "open";
  const createdBountiesPage =
    createdQuery.creatorId === id ? createdQuery.page : 1;
  const {
    bounties: createdBounties,
    total: createdBountiesTotal,
    pageSize: createdBountiesPageSize,
    queryStatus: createdBountiesQueryStatus,
    refreshCreatedBounties,
  } = useUserCreatedBounties(id, createdBountiesStatus, createdBountiesPage);

  useEffect(() => {
    setCreatedQuery({ creatorId: id, status: "open", page: 1 });
  }, [id]);

  const setCreatedBountiesStatus = (status: BountySearchQuery["status"]) => {
    setCreatedQuery({ creatorId: id, status, page: 1 });
  };

  const setCreatedBountiesPage = (page: number) => {
    setCreatedQuery((previous) => ({
      creatorId: id,
      status: previous.creatorId === id ? previous.status : "open",
      page,
    }));
  };

  const setWonBountiesPage = (page: number) => {
    setWonQuery({
      winnerId: id,
      page,
    });
  };

  const wonBountiesPage = wonQuery.winnerId === id ? wonQuery.page : 1;

  const {
    bounties: wonBounties,
    total: wonBountiesTotal,
    pageSize: wonBountiesPageSize,
    queryStatus: wonBountiesQueryStatus,
    refreshWonBounties,
  } = useUserWonBounties(id, wonBountiesPage);

  useEffect(() => {
    setWonQuery({ winnerId: id, page: 1 });
  }, [id]);

  const [userQueryStatus, setUserQueryStatus] = useState<
    "loading" | "errored" | "complete" | "notFound"
  >("loading");
  const [detailedUser, setDetailedUser] = useState<DetailedUser>();

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
  const claimKey = user?.identity.id === id ? id : null;
  const [claimStatus, setClaimStatus] = useState<{
    key: string;
    state: "loading" | "ready" | "error";
    claimed: boolean;
    nextClaimAt?: string;
  }>();
  const [claimStatusRefresh, setClaimStatusRefresh] = useState(0);
  const claimStatusRevision = useRef(0);
  const currentClaimStatus = claimStatus?.key === claimKey ? claimStatus : undefined;
  const claimed = currentClaimStatus?.claimed ?? false;
  const claimStatusLoading = !currentClaimStatus || currentClaimStatus.state === "loading";
  const claimStatusError = currentClaimStatus?.state === "error";
  const refreshClaimStatus = () => setClaimStatusRefresh(value => value + 1);
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
    setClaimMessage(null);
    setClaimError(null);

    setLedgerEntries([]);
    setLedgerPage(1);

    return () => {
      request.active = false;
    };
  }, [id, user?.identity.id]);

  useEffect(() => {
    const revision = ++claimStatusRevision.current;
    let active = true;
    if (!claimKey) {
      setClaimStatus(undefined);
      return;
    }
    setClaimStatus({ key: claimKey, state: "loading", claimed: false });
    void getDailyClaimStatus().then(status => {
      if (!active || revision !== claimStatusRevision.current) return;
      setClaimStatus({
        key: claimKey, state: "ready", claimed: status.claimedToday,
        nextClaimAt: status.claimedToday ? status.nextClaimAt : undefined,
      });
    }).catch(() => {
      if (active && revision === claimStatusRevision.current) {
        setClaimStatus({ key: claimKey, state: "error", claimed: false });
      }
    });
    return () => { active = false; };
  }, [claimKey, claimStatusRefresh]);

  useEffect(() => {
    if (!currentClaimStatus?.nextClaimAt || currentClaimStatus.state !== "ready") return;
    const timeout = setTimeout(() => {
      setClaimStatusRefresh(value => value + 1);
    }, Math.max(1000, Date.parse(currentClaimStatus.nextClaimAt) - Date.now()));
    return () => clearTimeout(timeout);
  }, [currentClaimStatus]);

  function markDailyClaimed() {
    if (!claimKey) return;
    // Ignore any status read started before this mutation completed.
    claimStatusRevision.current++;
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    setClaimStatus({ key: claimKey, state: "ready", claimed: true, nextClaimAt: next.toISOString() });
  }

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
    if (!userIsPageOwner || request.pending || claimed || claimStatusLoading || claimStatusError) return;

    request.pending = true;
    setClaimPending(true);
    setClaimMessage(null);
    setClaimError(null);

    try {
      await claimDailyBp();
      if (!request.active) return;
      markDailyClaimed();
      setClaimMessage("Claimed 25 BP.");
      refreshUser();
      refreshLedger();
      setLedgerPage(1);
      await refreshAccount();
    } catch (error) {
      if (request.active) {
        if (error instanceof ApiError && error.status === 409) {
          markDailyClaimed();
          setClaimMessage(
            "Already claimed today. Daily rewards reset at 00:00 UTC.",
          );
        } else {
          setClaimError(
            error instanceof ApiError
              ? error.message
              : "Could not claim the daily reward. Please try again.",
          );
        }
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

        const fetchedUser = await getUser(id);
        if (!ignore) {
          setDetailedUser(fetchedUser);
          setUserQueryStatus("complete");
        }
      } catch (error) {
        if (!ignore) {
          setUserQueryStatus(
            error instanceof ApiError &&
              (error.status === 404 || error.status === 400)
              ? "notFound"
              : "errored",
          );
        }
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

          const fetchedEntries = await getUserLedger(ledgerPage);
          if (!ignore) {
            setLedgerEntries(fetchedEntries);
            setLedgerQueryStatus("complete");
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

          const fetchedEvents = await getUserBountyEvents(id, eventsPage);
          if (!ignore) {
            setEvents(fetchedEvents);
            setEventsQueryStatus("complete");
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

  return {
    view,
    setView,
    hunts,
    huntsQueryStatus,
    refreshHunts,
    createdBounties,
    createdBountiesTotal,
    createdBountiesPageSize,
    createdBountiesQueryStatus,
    createdBountiesStatus,
    setCreatedBountiesStatus,
    createdBountiesPage,
    setCreatedBountiesPage,
    refreshCreatedBounties,
    wonBounties,
    wonBountiesTotal,
    wonBountiesPageSize,
    wonBountiesQueryStatus,
    wonBountiesPage,
    setWonBountiesPage,
    refreshWonBounties,
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
    claimStatusLoading,
    claimStatusError,
    refreshClaimStatus,
    claimMessage,
    claimError,
    claimDailyReward,
  };
}
