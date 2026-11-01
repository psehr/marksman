"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBounty } from "@/lib/api/bounties";
import { ApiError } from "@/lib/api/client";
import type { CreateBountyInput } from "@marksman/contracts";

export function useBountyCreation(refreshUser: () => Promise<void>) {
  const router = useRouter();
  const busy = useRef(false);
  const created = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: CreateBountyInput) {
    if (busy.current || created.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const bounty = await createBounty(input);
      created.current = true;
      await refreshUser();
      router.push(`/bounties/${bounty.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setError("Your session expired. Log in again before creating the bounty.");
        await refreshUser();
      } else if (error instanceof ApiError && error.code === "INSUFFICIENT_BP") {
        setError("You no longer have enough BP for this reward and fee. Your balance has been refreshed.");
        await refreshUser();
      } else if (error instanceof ApiError && error.status < 500) {
        setError(error.status === 403
          ? "This request was refused. Check that you opened the configured website address."
          : error.message);
      } else {
        setError("Could not confirm creation. Check your bounties before retrying, because the request may have succeeded.");
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { pending, error, submit };
}
