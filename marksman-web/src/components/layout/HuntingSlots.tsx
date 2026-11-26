"use client";

import { MAXIMUM_HUNTING_SLOTS } from "@marksman/contracts";
import { useHuntingSlots } from "@/hooks/useHuntingSlots";
import TargetIcon from "../ui/TargetIcon";

export default function HuntingSlots({ userId }: { userId: string }) {
  const { count, status, refresh } = useHuntingSlots(userId);
  const remaining =
    count === null ? null : Math.max(0, MAXIMUM_HUNTING_SLOTS - count);
  const label =
    status === "loading"
      ? "Loading hunting slots"
      : status === "error"
        ? "Hunting slots unavailable. Click to retry."
        : `${remaining} hunting ${remaining === 1 ? "slot" : "slots"} left`;
  return (
    <div
      role="group"
      aria-label="Hunting slots"
      className="flex h-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-border bg-card px-3 py-1"
    >
      {status === "error" ? (
        <button
          type="button"
          onClick={refresh}
          title={label}
          aria-label={label}
          className="text-xs text-foreground-muted underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Retry slots
        </button>
      ) : (
        <output
          aria-label={label}
          className="whitespace-nowrap text-xs text-foreground-muted tabular-nums"
        >
          {remaining === null
            ? "… slots left"
            : `${remaining} ${remaining === 1 ? "slot" : "slots"} left`}
        </output>
      )}
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: MAXIMUM_HUNTING_SLOTS }, (_, index) => (
          <span
            key={index}
            className={
              remaining === null || index >= remaining
                ? "grayscale opacity-30"
                : ""
            }
          >
            <TargetIcon size="sm" />
          </span>
        ))}
      </div>
    </div>
  );
}
