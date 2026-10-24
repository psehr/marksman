"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hunt } from "@marksman/contracts";
import { ApiError } from "@/lib/api/client";
import { getOngoingHunts, startHunt, stopHunt } from "@/lib/api/hunts";

/** Mount per account/bounty (see BountyHunt). Cleanup ignores late responses. */
export function useHunt(bountyId: string) {
  const [hunts, setHunts] = useState<Hunt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const busy = useRef(false);
  const hunt = hunts?.find((item) => item.bountyId === bountyId) ?? null;

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getOngoingHunts(controller.signal).then((result) => {
      if (generation.current === current) setHunts(result);
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
      controller.abort();
    };
  }, [bountyId, revision]);

  const refresh = useCallback(() => {
    if (!busy.current) setRevision((value) => value + 1);
  }, []);

  async function toggle() {
    if (busy.current || loading || hunts === null) return;
    busy.current = true;
    const current = generation.current;
    setPending(true);
    setError(null);
    try {
      const result = hunt ? await stopHunt(hunt.id) : await startHunt(bountyId);
      if (generation.current !== current) return;
      setHunts((previous) => {
        const remaining = (previous ?? []).filter((item) => item.bountyId !== bountyId);
        return result.status === "ongoing" ? [...remaining, result] : remaining;
      });
    } catch (error) {
      if (generation.current === current) {
        // The request may have succeeded despite a lost response. Reload before retrying.
        setHunts(null);
        setError(error instanceof ApiError ? error.message : "Could not update hunt. Reload hunts to check its status.");
      }
    } finally {
      busy.current = false;
      if (generation.current === current) setPending(false);
    }
  }

  return { isHunting: hunt !== null, count: hunts?.length ?? 0, loading, pending,
    error, ready: hunts !== null, onToggle: toggle, onRefresh: refresh };
}
