"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";

export default function ShareBounty({ bountyId }: { bountyId: string }) {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const busy = useRef(false);
  const revision = useRef(0);

  useEffect(() => () => { revision.current++; }, []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function share() {
    if (busy.current) return;
    busy.current = true;
    const request = ++revision.current;
    const url = new URL(`/bounties/${bountyId}`, window.location.origin).href;
    setPending(true);
    setCopied(false);
    setFallbackUrl(null);
    try {
      await navigator.clipboard.writeText(url);
      if (request === revision.current) setCopied(true);
    } catch {
      if (request === revision.current) setFallbackUrl(url);
    } finally {
      busy.current = false;
      if (request === revision.current) setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button size="lg" disabled={pending} onClick={() => void share()}>
        {pending ? "Copying…" : "Share bounty"}
      </Button>
      {copied ? <p role="status" className="text-sm text-success">Link copied!</p> : null}
      {fallbackUrl ? (
        <>
          <p role="alert" className="text-sm">Could not copy the link. You can copy it below.</p>
          <input
            aria-label="Bounty link"
            readOnly
            value={fallbackUrl}
            onFocus={event => event.currentTarget.select()}
            className="w-full min-w-0 rounded border border-border bg-surface p-2 text-sm"
          />
        </>
      ) : null}
    </div>
  );
}
