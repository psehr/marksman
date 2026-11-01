import BPIcon from "@/components/economy/BPIcon";
import { RewardStepProps } from "./creation-tool.types";
import TextInput from "@/components/ui/TextInput";
import Button from "@/components/ui/Button";
import { rewardFee } from "./creation-tool.utils";

export default function RewardStep({ props }: { props: RewardStepProps }) {
  return (
    <div className="flex flex-col items-start gap-4 w-full text-left">
      <label htmlFor="reward">Completion Reward</label>
      <TextInput
        type="number"
        placeholder="Type a reward amount here..."
        id="reward"
        value={!Number.isNaN(props.reward) ? props.reward : ""}
        onChange={(event) => props.setReward(event.target.valueAsNumber)}
      />
      <section className="flex w-full place-content-between">
        <p>
          The creation fee is set to 10% of the reward and is non-refundable.
        </p>
        <div className="flex gap-1 items-center">
          <p className="leading-none -translate-y-px">
            Creation Fee:{" "}
            <span className="font-bold">
              {!Number.isNaN(props.reward) ? rewardFee(props.reward) : "-"}
            </span>
          </p>
          <BPIcon size="sm" />
        </div>
      </section>
      <section className="w-full flex place-content-between">
        <div className="flex gap-1 items-center">
          <p className="leading-none -translate-y-px">
            Available balance:{" "}
            <span className="font-bold">{props.balance}</span>
          </p>
          <BPIcon size="sm" />
        </div>
        <div className="flex gap-1 items-center">
          <p className="leading-none -translate-y-px">
            Total cost:{" "}
            <span className="font-bold">
              {!Number.isNaN(props.reward)
                ? props.reward + rewardFee(props.reward)
                : "-"}
            </span>
          </p>
          <BPIcon size="sm" />
        </div>
        <div className="flex gap-1 items-center">
          <p className="leading-none -translate-y-px">
            Future balance:{" "}
            <span className="font-bold">
              {!Number.isNaN(props.reward) && props.balance !== null
                ? props.balance - props.reward - rewardFee(props.reward)
                : "-"}
            </span>
          </p>
          <BPIcon size="sm" />
        </div>
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
