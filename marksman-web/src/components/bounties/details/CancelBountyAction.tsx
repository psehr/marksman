"use client";

import { useId, useRef, useState } from "react";
import type { useBountyActions } from "@/hooks/useBountyActions";
import Button from "@/components/ui/Button";
import ActionIcon from "@/components/ui/ActionIcon";

type Props = { cancel: ReturnType<typeof useBountyActions>["cancel"] };

export default function CancelBountyAction({ cancel }: Props) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  function dismiss() {
    if (cancel.pending) return;
    setConfirming(false);
    trigger.current?.focus();
  }
  return (
    <div className="flex flex-col gap-2 col-span-full">
      <Button
        ref={trigger}
        size="lg"
        variant="danger"
        disabled={cancel.pending}
        aria-expanded={confirming && !cancel.refreshFailed}
        aria-controls={panelId}
        onClick={() => {
          if (cancel.refreshFailed) void cancel.run();
          else setConfirming(true);
        }}
      >
        <ActionIcon action={cancel.pending || cancel.refreshFailed ? "refresh" : "cancel"} />
        {cancel.pending ? "Cancelling..." : cancel.refreshFailed ? "Retry refresh" : "Cancel bounty"}
      </Button>
      {confirming && !cancel.refreshFailed && (
        <div
          id={panelId}
          role="group"
          aria-label="Confirm bounty cancellation"
          className="flex flex-col gap-3 rounded border border-danger/50 bg-surface p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); dismiss(); }
          }}
        >
          <p className="text-sm">Cancel this bounty? This cannot be undone. All funders will receive their contributed BP back. Fees will not be refunded.</p>
          <div className="flex flex-wrap gap-2">
            <Button autoFocus disabled={cancel.pending} onClick={dismiss}>Keep bounty</Button>
            <Button variant="danger" disabled={cancel.pending} onClick={() => void cancel.run()}>
              {cancel.pending ? "Cancelling..." : "Confirm cancellation"}
            </Button>
          </div>
        </div>
      )}
      {cancel.error && <p role="alert">{cancel.error}</p>}
    </div>
  );
}
