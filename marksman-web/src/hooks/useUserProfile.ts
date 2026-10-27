import { useAuth } from "@/components/auth/AuthProvider";
import { getUser, getUserLedger, getUserBountyEvents } from "@/lib/api/users";
import { claimDailyBp } from "@/lib/api/economy";
import { ApiError } from "@/lib/api/client";
import type { BountyEvent, LedgerEntry, User } from "@marksman/contracts";
import { useEffect, useRef, useState } from "react";

export function useUserProfile(id: string) {
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
      await claimDailyBp();
      if (!request.active) return;
      setClaimed(true);
      setClaimMessage("Claimed 25 BP.");
      refreshUser();
      refreshLedger();
      setLedgerPage(1);
      await refreshAccount();
    } catch (error) {
      if (request.active) {
        if (error instanceof ApiError && error.status === 409) {
          setClaimed(true);
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
  };
}
