"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { cancelBounty, setBountyBookmark } from "@/lib/api/bounties";
import { useAuth } from "@/components/auth/AuthProvider";
import { publishBountyAction, subscribeBountyActions } from "@/lib/bounty-action-events";
import { useActionLock } from "./useActionLock";

/** Mount per identity/bounty. Each action has an independent request lock. */
function useAction(request: () => Promise<unknown>, onSuccess: () => void | Promise<void>, refreshError: string, key: string) {
  const lock = useActionLock(key);
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
    if (busy.current || !lock.acquire()) return;
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
      lock.release();
      if (generation.current === current) setPending(false);
    }
  }

  return { pending: pending || lock.locked, error, refreshFailed, run };
}

export function useBountyActions(
  bountyId: string,
  isBookmarked: boolean,
  onCancel: () => void | Promise<void>,
  onBookmark: () => Promise<void>,
) {
  const { user } = useAuth();
  const userId = user?.identity.id;
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  useEffect(() => { setBookmarked(isBookmarked); }, [isBookmarked]);
  useEffect(() => subscribeBountyActions((event) => {
    if (event.type === "bookmark" && event.userId === userId && event.bountyId === bountyId) {
      setBookmarked(event.bookmarked);
    }
  }), [bountyId, userId]);
  const cancel = useAction(() => cancelBounty(bountyId), onCancel,
    "Bounty cancelled, but the display could not refresh. Please retry.", `${userId}:${bountyId}:cancel`);
  const bookmark = useAction(async () => {
    await setBountyBookmark(bountyId, !bookmarked);
    if (userId) publishBountyAction({ type: "bookmark", userId, bountyId, bookmarked: !bookmarked });
  }, onBookmark,
    "Bookmark change saved, but its displayed state could not refresh. Please retry.", `${userId}:${bountyId}:bookmark`);
  return { cancel, bookmark: { ...bookmark, isBookmarked: bookmarked } };
}
