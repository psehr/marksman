import BPIcon from "@/components/economy/BPIcon";
import { rewardFee } from "./creation-tool.utils";

export default function CostBreakdown({ balance, reward }: { balance: number | null; reward: number }) {
  const fee = rewardFee(reward);
  const totalCost = reward + fee;
  return (
    <div className="flex flex-1 flex-col gap-2 min-w-0 w-full border border-border rounded p-2 bg-surface-raised text-left">

      <section className="flex w-full min-w-0 flex-col gap-4">
        <div className="flex w-full min-w-0 flex-col gap-1">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
            <span>Current Balance:</span>
            <span className="wrap-anywhere text-right font-bold text-accent">
              {balance?.toLocaleString() ?? "-"}
            </span>
            <BPIcon size="sm" />
          </div>

          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
            <span>Future Balance:</span>
            <span className="wrap-anywhere text-right font-bold text-accent">
              {balance !== null && reward !== null && fee !== null
                ? (balance - reward - fee).toLocaleString()
                : "-"}
            </span>
            <BPIcon size="sm" />
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-1">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
            <span>Base Reward:</span>
            <span className="wrap-anywhere text-right font-bold text-accent">
              {reward ? reward.toLocaleString() : "-"}
            </span>
            <BPIcon size="sm" />
          </div>
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
            <span>Creation Fee:</span>
            <span className="wrap-anywhere text-right font-bold text-accent">
              {fee ? fee.toLocaleString() : "-"}
            </span>
            <BPIcon size="sm" />
          </div>
          <span className="w-full border-t border-border" />
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 font-bold">
            <span>Total Cost:</span>
            <span className="wrap-anywhere text-right font-bold text-accent">
              {totalCost ? totalCost.toLocaleString() : "-"}
            </span>
            <BPIcon size="sm" />
          </div>
        </div>
      </section>

      <p className="text-right text-xs text-foreground-muted">
        The creation fee is set to 10% of the reward and is non-refundable.
      </p>
    </div>
  );
}
