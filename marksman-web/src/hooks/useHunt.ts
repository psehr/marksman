"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hunt } from "@marksman/contracts";
import { ApiError } from "@/lib/api/client";
import { getOngoingHunts, startHunt, stopHunt } from "@/lib/api/hunts";
import { useAuth } from "@/components/auth/AuthProvider";
import { publishBountyAction, subscribeBountyActions } from "@/lib/bounty-action-events";
import { useActionLock } from "./useActionLock";

// Cards mounted together share the same read, scoped to the signed-in identity.
type HuntRead = { promise: Promise<Hunt[]>; controller: AbortController; readers: number };
const reads = new Map<string, HuntRead>();
function readHunts(userId: string) {
  let entry = reads.get(userId);
  if (!entry) {
    const controller = new AbortController();
    const created: HuntRead = { controller, readers: 0, promise: getOngoingHunts(controller.signal).finally(() => {
      if (reads.get(userId) === created) reads.delete(userId);
    }) };
    entry = created;
    reads.set(userId, entry);
  }
  const current = entry;
  current.readers++;
  return {
    promise: current.promise,
    release() {
      if (--current.readers === 0) {
        current.controller.abort();
        if (reads.get(userId) === current) reads.delete(userId);
      }
    },
  };
}

/** Mount per account/bounty (see BountyHunt). Cleanup ignores late responses. */
export function useHunt(bountyId: string) {
  const { user } = useAuth();
  const userId = user?.identity.id ?? "anonymous";
  const lock = useActionLock(`${userId}:${bountyId}:hunt`);
  const [hunts, setHunts] = useState<Hunt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const updates = useRef(new Map<string, Hunt>());
  const hunt = hunts?.find((item) => item.bountyId === bountyId) ?? null;

  useEffect(() => {
    const current = ++generation.current;
    updates.current.clear();
    setLoading(true);
    setError(null);
    const read = readHunts(userId);
    read.promise.then((result) => {
      if (generation.current === current) {
        const merged = result.filter((item) => !updates.current.has(item.bountyId));
        setHunts([...merged, ...Array.from(updates.current.values()).filter((item) => item.status === "ongoing")]);
      }
    }).catch((error: unknown) => {
      if (generation.current === current) {
        setHunts(null);
        setError(error instanceof ApiError ? error.message : "Could not load hunts. Please try again.");
      }
    }).finally(() => {
      if (generation.current === current) setLoading(false);
    });
    return () => {
      generation.current++;
      read.release();
    };
  }, [bountyId, revision, userId]);

  useEffect(() => subscribeBountyActions((event) => {
    if (event.type === "hunt-invalidated" && event.userId === userId) {
      reads.get(userId)?.controller.abort();
      reads.delete(userId);
      generation.current++;
      setLoading(false);
      setHunts(null);
      return;
    }
    if (event.type !== "hunt" || event.userId !== userId) return;
    updates.current.set(event.hunt.bountyId, event.hunt);
    setHunts((previous) => {
      if (previous === null) return previous;
      const remaining = previous.filter((item) => item.bountyId !== event.hunt.bountyId);
      return event.hunt.status === "ongoing" ? [...remaining, event.hunt] : remaining;
    });
  }), [userId]);

  const refresh = useCallback(() => {
    if (!busy.current) setRevision((value) => value + 1);
  }, []);

  async function toggle() {
    if (busy.current || loading || hunts === null || !lock.acquire()) return;
    busy.current = true;
    const current = generation.current;
    setPending(true);
    setError(null);
    try {
      const result = hunt ? await stopHunt(hunt.id) : await startHunt(bountyId);
      publishBountyAction({ type: "hunt", userId, hunt: result });
      if (generation.current !== current) return;
      setHunts((previous) => {
        const remaining = (previous ?? []).filter((item) => item.bountyId !== bountyId);
        return result.status === "ongoing" ? [...remaining, result] : remaining;
      });
    } catch (error) {
      const currentRequest = generation.current === current;
      publishBountyAction({ type: "hunt-invalidated", userId });
      if (currentRequest && mounted.current) {
        // The request may have succeeded despite a lost response. Reload before retrying.
        setHunts(null);
        setError(error instanceof ApiError ? error.message : "Could not update hunt. Reload hunts to check its status.");
      }
    } finally {
      busy.current = false;
      lock.release();
      if (mounted.current) setPending(false);
    }
  }

  return { isHunting: hunt !== null, count: hunts?.length ?? 0, loading, pending: pending || lock.locked,
    error, ready: hunts !== null, onToggle: toggle, onRefresh: refresh };
}
