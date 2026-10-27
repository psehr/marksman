import { getBounty } from "@/lib/api/bounties";
import { ExtendedBounty } from "@marksman/contracts";
import { ApiError } from "@/lib/api/client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export function useBountyDetails(bountyId: string) {
  const [queryStatus, setQueryStatus] = useState<
    "loading" | "errored" | "complete" | "notFound"
  >("loading");
  const [bounty, setBounty] = useState<ExtendedBounty>();
  const [refresh, setRefresh] = useState(0);
  const refreshBounty = () => {
    setRefresh((previous) => previous + 1);
  };
  const generation = useRef(0);
  const engagementRevision = useRef(0);
  const refreshEngagement = async () => {
    const current = generation.current;
    const revision = ++engagementRevision.current;
    const updated = await getBounty(bountyId);
    if (
      generation.current !== current ||
      engagementRevision.current !== revision
    )
      return;
    engagementRevision.current++;
    setBounty((previous) =>
      previous ? { ...previous, engagement: updated.engagement } : previous,
    );
  };
  const { user } = useAuth();

  const AUTOMATIC_POLLING_INTERVAL = 5_000;

  useEffect(() => {
    generation.current++;
    let ignore = false;
    let hasLoaded = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const revision = engagementRevision.current;
        const bounty = await getBounty(bountyId);
        if (ignore) return;

        setBounty((previous) =>
          revision !== engagementRevision.current && previous
            ? { ...bounty, engagement: previous.engagement }
            : bounty,
        );
        setQueryStatus("complete");

        hasLoaded = true;

        if (bounty.status === "open") {
          timer = setTimeout(() => void load(), AUTOMATIC_POLLING_INTERVAL);
        }
      } catch (error) {
        if (ignore) return;

        if (error instanceof ApiError && error.status === 404) {
          return setQueryStatus("notFound");
        } else if (!hasLoaded) {
          setQueryStatus("errored");
        }

        timer = setTimeout(() => void load(), AUTOMATIC_POLLING_INTERVAL);
      }
    }

    setQueryStatus("loading");
    void load();

    return () => {
      ignore = true;
      generation.current++;
      clearTimeout(timer);
    };
  }, [bountyId, refresh, user?.identity.id]);

  return { bounty, queryStatus, refreshBounty, refreshEngagement };
}
