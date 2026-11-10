import ActionIcon from "@/components/ui/ActionIcon";
import type { CreateBountyInput } from "@marksman/contracts";
import Button from "@/components/ui/Button";
import Link from "next/link";
import LoginStep from "./LoginStep";
import type { LoginStepProps } from "./creation-tool.types";
import CostBreakdown from "./CostBreakdown";
import { rewardFee } from "./creation-tool.utils";

type ReviewStepProps = {
  input: CreateBountyInput | null;
  balance: number | null;
  errors: string[];
  pending: boolean;
  error: string | null;
  canSubmit: boolean;
  login: LoginStepProps;
  customizeStableComboThreshold: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export default function ReviewStep({ props }: { props: ReviewStepProps }) {
  const { input } = props;
  const goal = input?.goal;
  const total = input ? input.rewardBp + rewardFee(input.rewardBp) : null;
  return (
    <div className="flex w-full flex-col gap-4 text-end">
      {goal?.type === "full_combo" && props.customizeStableComboThreshold ? (
        <p className="text-sm text-foreground-muted">
          Stable combo threshold:{" "}
          {((goal.minimumComboRatio ?? 0.99) * 100).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}
          %
        </p>
      ) : null}

      {input ? (
        <CostBreakdown balance={props.balance} reward={input.rewardBp} />
      ) : null}
      {!props.login.user || props.login.accountLoading ? (
        <LoginStep props={props.login} />
      ) : null}
      {props.errors.map((error) => (
        <p role="alert" className="text-danger" key={error}>
          {error}
        </p>
      ))}
      {props.error ? (
        <p role="alert" className="text-danger">
          {props.error}{" "}
          <Link href="/bounties" className="underline">
            View bounties
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={props.pending}
          onClick={props.onBack}
        >
          <ActionIcon action="back" />
          Back
        </Button>
        <Button
          variant="accent"
          disabled={!props.canSubmit || props.pending}
          onClick={props.onSubmit}
        >
          {props.pending
            ? "Creating…"
            : `Create bounty${total !== null ? ` · ${total.toLocaleString()} BP` : ""}`}
        </Button>
      </div>
    </div>
  );
}
