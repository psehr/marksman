import { useAuth } from "@/components/auth/AuthProvider";
import { getBounties } from "@/lib/api/bounties";
import type { BountyListResponse, BountySearchQuery } from "@marksman/contracts";
import { useEffect, useState } from "react";

export function useBounties(query: BountySearchQuery) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.identity.id;
  // A primitive key prevents equivalent URL-derived arrays from refetching.
  const queryKey = JSON.stringify({
    ...query,
    relationship: userId ? query.relationship : "all",
  });
  const requestKey = `${userId ?? "anonymous"}:${queryKey}`;
  const [state, setState] = useState<{
    key: string;
    status: "loading" | "errored" | "complete";
    data?: BountyListResponse;
  }>({ key: "", status: "loading" });

  useEffect(() => {
    if (authLoading) return;
    let ignore = false;
    setState({ key: requestKey, status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const data = await getBounties(JSON.parse(queryKey) as BountySearchQuery);
        if (!ignore) setState({ key: requestKey, status: "complete", data });
      } catch {
        if (!ignore) setState({ key: requestKey, status: "errored" });
      }
    }, 250);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [authLoading, queryKey, requestKey]);

  const current = !authLoading && state.key === requestKey;
  return {
    bounties: current ? state.data?.items ?? [] : [],
    total: current ? state.data?.total ?? 0 : 0,
    pageSize: current ? state.data?.pageSize : undefined,
    queryStatus: current ? state.status : "loading" as const,
  };
}
