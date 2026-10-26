"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { cancelBounty, setBountyBookmark } from "@/lib/api/bounties";

/** Mount per identity/bounty. Each action has an independent request lock. */
function useAction(request: () => Promise<unknown>, onSuccess: () => void | Promise<void>, refreshError: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const needsRefresh = useRef(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    return () => { generation.current++; };
  }, []);

  async function run() {
    if (busy.current) return;
    busy.current = true;
    const current = generation.current;
    setPending(true);
    setError(null);
    try {
      if (!needsRefresh.current) await request();
      if (generation.current !== current) return;
      needsRefresh.current = true;
      await onSuccess();
      if (generation.current !== current) return;
      needsRefresh.current = false;
      setRefreshFailed(false);
    } catch (error) {
      if (generation.current === current) {
        setRefreshFailed(needsRefresh.current);
        setError(needsRefresh.current ? refreshError : error instanceof ApiError ? error.message : "Could not update the bounty. Please try again.");
      }
    } finally {
      busy.current = false;
      if (generation.current === current) setPending(false);
    }
  }

  return { pending, error, refreshFailed, run };
}

export function useBountyActions(
  bountyId: string,
  isBookmarked: boolean,
  onCancel: () => void | Promise<void>,
  onBookmark: () => Promise<void>,
) {
  const cancel = useAction(() => cancelBounty(bountyId), onCancel,
    "Bounty cancelled, but the display could not refresh. Please retry.");
  const bookmark = useAction(() => setBountyBookmark(bountyId, !isBookmarked), onBookmark,
    "Bookmark change saved, but its displayed state could not refresh. Please retry.");
  return { cancel, bookmark };
}
