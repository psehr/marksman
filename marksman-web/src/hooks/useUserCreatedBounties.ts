import { getBounties } from "@/lib/api/bounties";
import type {
  BountyListResponse,
  BountySearchQuery,
} from "@marksman/contracts";
import { useEffect, useState } from "react";

type UserCreatedBounties = {
  key: string;
  data?: BountyListResponse;
  status: "loading" | "errored" | "complete";
};

export function useUserCreatedBounties(
  creatorId: string,
  status: BountySearchQuery["status"],
  page: number,
) {
  const [refresh, setRefresh] = useState(0);
  const requestKey = JSON.stringify([creatorId, status, page, refresh]);
  const [state, setState] = useState<UserCreatedBounties>({
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
          { creatorId, status, page },
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
  }, [creatorId, status, page, requestKey]);

  const current = state.key === requestKey;
  return {
    bounties: current ? (state.data?.items ?? []) : [],
    total: current ? (state.data?.total ?? 0) : 0,
    pageSize: current ? state.data?.pageSize : undefined,
    queryStatus: current ? state.status : ("loading" as const),
    refreshCreatedBounties: () => setRefresh((previous) => previous + 1),
  };
}
