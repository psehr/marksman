import { useEffect, useState } from "react";
import type { BountyFundingBreakdown } from "@marksman/contracts";
import { getBountyFundingBreakdown } from "@/lib/api/bounties";

export function useBountyFundingBreakdown(bountyId: string, rewardBp: number) {
  const [revision, setRevision] = useState(0);
  const key = `${bountyId}:${rewardBp}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    status: "complete" | "errored";
    data?: BountyFundingBreakdown;
  } | null>(null);

  useEffect(() => {
    let ignore = false;

    getBountyFundingBreakdown(bountyId).then(
      (data) => {
        if (!ignore) setState({ key, status: "complete", data });
      },
      () => {
        if (!ignore) setState({ key, status: "errored" });
      },
    );

    return () => {
      ignore = true;
    };
  }, [bountyId, key]);

  const current = state?.key === key;

  return {
    funders: current ? (state.data ?? []) : [],
    status: current ? state.status : "loading",
    retry: () => setRevision((value) => value + 1),
  };
}
