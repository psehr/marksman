import { getBounty } from "@/lib/api/bounties";
import { ExtendedBounty } from "@marksman/contracts";
import { ApiError } from "@/lib/api/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function useBountyDetails(bountyId: string) {
  const [queryStatus, setQueryStatus] = useState<
    "loading" | "errored" | "complete" | "notFound"
  >("loading");
  const [bounty, setBounty] = useState<ExtendedBounty>();
  const [refresh, setRefresh] = useState(0);
  const refreshBounty = () => {
    setRefresh((previous) => previous + 1);
  };

  const { user } = useAuth();

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const bounty = await getBounty(bountyId);
        if (ignore) return;

        setBounty(bounty);
        setQueryStatus("complete");
      } catch (error) {
        if (ignore) return;
        setQueryStatus(
          error instanceof ApiError && error.status === 404
            ? "notFound"
            : "errored",
        );
      }
    }

    setQueryStatus("loading");
    void load();

    return () => {
      ignore = true;
    };
  }, [bountyId, refresh, user?.identity.id]);

  return { bounty, queryStatus, refreshBounty };
}
