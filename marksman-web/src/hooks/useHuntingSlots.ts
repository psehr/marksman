"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getOngoingHunts } from "@/lib/api/hunts";
import { subscribeBountyActions } from "@/lib/bounty-action-events";

export function useHuntingSlots(userId: string) {
  const path = usePathname();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ count: number | null; status: "loading" | "complete" | "error" }>({ count: null, status: "loading" });
  useEffect(() => {
    let disposed = false;
    let request = 0;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      const current = ++request;
      clearTimeout(timer);
      controller?.abort();
      controller = new AbortController();
      try {
        const hunts = await getOngoingHunts(controller.signal);
        if (!disposed && current === request) setState({ count: hunts.length, status: "complete" });
      } catch {
        if (!disposed && current === request) setState({ count: null, status: "error" });
      } finally {
        if (!disposed && current === request) timer = setTimeout(() => void load(), 30_000);
      }
    }
    setState({ count: null, status: "loading" });
    void load();
    const unsubscribe = subscribeBountyActions(event => {
      if (event.userId === userId && (event.type === "hunt" || event.type === "hunt-invalidated")) void load();
    });
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, path, revision]);
  return { ...state, refresh: () => setRevision(value => value + 1) };
}
