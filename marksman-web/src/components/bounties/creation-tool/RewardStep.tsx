import BPIcon from "@/components/economy/BPIcon";
import { RewardStepProps } from "./creation-tool.types";
import TextInput from "@/components/ui/TextInput";
import { rewardFee } from "./creation-tool.utils";
import BountyTierBadge from "../BountyTierBadge";
import { bountyTiers, getBountyTier } from "@marksman/contracts";
import { aes_font } from "@/lib/fonts";

export default function RewardStep({ props }: { props: RewardStepProps }) {
  const balance = props.balance !== null ? props.balance : null;
  const reward =
    Number.isInteger(props.reward) && props.reward > 0 ? props.reward : null;
  const fee = reward && reward > 0 ? rewardFee(reward) : null;
  const totalCost = reward && fee ? reward + fee : null;

  const currentTier =
    Number.isInteger(props.reward) && props.reward > 0
      ? getBountyTier(props.reward)
      : null;

  function tierBreakdown() {
    return (
      <div className="flex flex-col gap-2 flex-1 min-w-0 w-full p-2 place-content-around items-end">
        <div className="grid grid-cols-2 md:flex md:flex-row flex-wrap gap-1 w-full place-content-end">
          {allTiers.map((tier) => (
            <button
              key={tier.name}
              type="button"
              onClick={() => props.setReward(tier.minimumBp)}
              aria-label={`Set reward to ${tier.minimumBp.toLocaleString()} BP (${tier.name})`}
              className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <BountyTierBadge
                tier={tier.name}
                size="xl"
                className={`${currentTier !== tier.name ? "opacity-20" : ""} w-28 sm:w-fit`}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const allTiers = [...bountyTiers].reverse();
  const insufficientBalance =
    balance !== null && totalCost !== null && balance < totalCost;

  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label="Available balance"
          className={`flex w-full flex-wrap items-center justify-end gap-2 sm:order-last sm:w-auto sm:shrink-0 ${insufficientBalance ? "text-danger" : "text-foreground"}`}
        >
          <span className="text-sm">Available balance:</span>
          <span
            className={`${aes_font.className} inline-flex items-center gap-1 text-lg font-bold tabular-nums`}
          >
            {balance?.toLocaleString() ?? "—"}
            <BPIcon />
          </span>
        </div>
        <p
          aria-label="Reward cost summary"
          className="w-full min-w-0 text-right text-xs text-foreground-muted wrap-anywhere sm:flex-1 sm:text-left"
        >
          Reward: {reward?.toLocaleString() ?? "—"} BP · Fee:{" "}
          {fee?.toLocaleString() ?? "—"} BP · Total:{" "}
          {totalCost?.toLocaleString() ?? "—"} BP
        </p>
      </div>
      <label htmlFor="reward" className="sr-only">
        Reward Input
      </label>
      <div className="relative w-full">
        <TextInput
          className="text-end pr-12"
          size="xl"
          type="number"
          placeholder="Type a reward amount here..."
          id="reward"
          value={!Number.isNaN(props.reward) ? props.reward : ""}
          onChange={(event) => props.setReward(event.target.valueAsNumber)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          <BPIcon />
        </span>
      </div>
      {tierBreakdown()}
      <section className="w-full flex flex-col items-end">
        {props.validationErrors.map((error) => (
          <p role="alert" className="text-danger font-bold text-sm" key={error}>
            {error}
          </p>
        ))}
      </section>
    </div>
  );
}
