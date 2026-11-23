import type { CreateBountyInput } from "@marksman/contracts";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { rewardFee } from "./creation-tool.utils";

type CreationSubmitProps = {
  input: CreateBountyInput | null;
  errors: string[];
  pending: boolean;
  error: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
};

export default function CreationSubmit({ props }: { props: CreationSubmitProps }) {
  const { input } = props;
  const total = input ? input.rewardBp + rewardFee(input.rewardBp) : null;
  return (
    <div className="flex w-full flex-col gap-4 text-end">
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
