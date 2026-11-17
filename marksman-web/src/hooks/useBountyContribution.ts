"use client";

import { useEffect, useRef, useState } from "react";
import { bountyContributionRequestSchema, type BountyContributionRequest } from "@marksman/contracts";
import { contributeToBounty } from "@/lib/api/bounties";
import { ApiError } from "@/lib/api/client";

/** Mount per user/bounty. Keep an uncertain request's key until its amount changes. */
export function useBountyContribution(bountyId: string, refresh: () => Promise<void>) {
  const [amount, setAmountState] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [complete, setComplete] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const request = useRef<BountyContributionRequest | null>(null);
  const committed = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    return () => { generation.current++; };
  }, []);

  function setAmount(value: string) {
    if (busy.current || committed.current) return;
    if (value !== amount) {
      request.current = null;
      setRetrying(false);
      setError(null);
    }
    setAmountState(value);
  }

  async function submit() {
    if (busy.current || complete) return;
    busy.current = true;
    const current = generation.current;
    setPending(true);
    setError(null);
    try {
      if (!committed.current) {
        if (!request.current) {
          request.current = bountyContributionRequestSchema.parse({
            amountBp: Number(amount), idempotencyKey: crypto.randomUUID(),
          });
        }
        await contributeToBounty(bountyId, request.current);
        if (generation.current !== current) return;
        committed.current = true;
        setSaved(true);
      }
      await refresh();
      if (generation.current !== current) return;
      setComplete(true);
      setRetrying(false);
    } catch (error) {
      if (generation.current !== current) return;
      setRetrying(request.current !== null);
      setError(committed.current
        ? "Contribution saved, but the reward or balance could not refresh. Retry the refresh."
        : error instanceof ApiError ? error.message
        : "Could not confirm your contribution. Retry the same amount to check it safely.");
    } finally {
      busy.current = false;
      if (generation.current === current) setPending(false);
    }
  }

  function reset() {
    if (busy.current || !complete) return;
    request.current = null;
    committed.current = false;
    setAmountState("");
    setSaved(false);
    setComplete(false);
    setRetrying(false);
    setError(null);
  }

  return { amount, setAmount, pending, error, saved, complete, retrying, submit, reset };
}
