import BPIcon from "@/components/economy/BPIcon";
import { RewardStepProps } from "./creation-tool.types";
import TextInput from "@/components/ui/TextInput";
import Button from "@/components/ui/Button";
import { rewardFee } from "./creation-tool.utils";

export default function RewardStep({ props }: { props: RewardStepProps }) {
  return (
    <div className="flex flex-col items-start gap-4 w-full">
      <label htmlFor="reward" className="sr-only">
        Reward Input
      </label>
      <div className="relative w-full">
        <TextInput
          className="text-center pr-12"
          size="xl"
          type="number"
          placeholder="Type a reward amount here..."
          id="reward"
          value={!Number.isNaN(props.reward) ? props.reward : ""}
          onChange={(event) => props.setReward(event.target.valueAsNumber)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
          BP
        </span>
      </div>

      <section className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-2 justify-items-end md:justify-items-center">
        <div className="flex gap-1 items-center">
          <span>Available Balance:</span>
          <span className="font-bold text-accent">
            {props.balance?.toLocaleString() ?? "-"}
          </span>
          <BPIcon size="sm" />
        </div>
        <div className="flex gap-1 items-center">
          <span>Creation Fee:</span>
          <span className="font-bold text-accent">
            {!Number.isNaN(props.reward)
              ? rewardFee(props.reward).toLocaleString()
              : "-"}
          </span>{" "}
          <BPIcon size="sm" />
        </div>
        <div className="flex gap-1 items-center">
          <span>Future Balance:</span>
          <span className="font-bold text-accent">
            {!Number.isNaN(props.reward) && props.balance !== null
              ? (
                  props.balance -
                  props.reward -
                  rewardFee(props.reward)
                ).toLocaleString()
              : "-"}
          </span>
          <BPIcon size="sm" />
        </div>
        <div className="flex gap-1 items-center">
          <span>Total Cost:</span>
          <span className="font-bold text-accent">
            {!Number.isNaN(props.reward)
              ? (props.reward + rewardFee(props.reward)).toLocaleString()
              : "-"}
          </span>
          <BPIcon size="sm" />
        </div>
      </section>
      <section className="flex w-full place-content-end md:place-content-center text-xs text-foreground-muted">
        <p>
          The creation fee is set to 10% of the reward and is non-refundable.
        </p>
      </section>
      <section className="w-full flex flex-col items-center">
        {props.validationErrors.map((error) => (
          <p role="alert" className="text-danger font-bold text-sm" key={error}>
            {error}
          </p>
        ))}
      </section>

      <div className="flex gap-2 place-content-end w-full">
        <Button onClick={props.onBack} variant="outline">
          Back
        </Button>

        <Button
          onClick={props.onContinue}
          variant="accent"
          disabled={!props.isRewardValid}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
