import { getBounties } from "@/lib/api/bounties";
import type { BountyListResponse } from "@marksman/contracts";
import { useEffect, useState } from "react";

type UserWonBounties = {
  key: string;
  data?: BountyListResponse;
  status: "loading" | "errored" | "complete";
};

export function useUserWonBounties(winnerId: string, page: number) {
  const [refresh, setRefresh] = useState(0);
  const requestKey = JSON.stringify([winnerId, page, refresh]);
  const [state, setState] = useState<UserWonBounties>({
    key: "",
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    setState({ key: requestKey, status: "loading" });

    async function load() {
      try {
        const data = await getBounties(
          { winnerId, status: "completed", page },
          controller.signal,
        );
        if (!ignore) setState({ key: requestKey, data, status: "complete" });
      } catch {
        if (!ignore) setState({ key: requestKey, status: "errored" });
      }
    }

    void load();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [winnerId, page, requestKey]);

  const current = state.key === requestKey;
  return {
    bounties: current ? (state.data?.items ?? []) : [],
    total: current ? (state.data?.total ?? 0) : 0,
    pageSize: current ? state.data?.pageSize : undefined,
    queryStatus: current ? state.status : ("loading" as const),
    refreshWonBounties: () => setRefresh((previous) => previous + 1),
  };
}
