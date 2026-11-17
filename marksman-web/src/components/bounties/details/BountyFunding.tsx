"use client";

import { useState } from "react";
import { MAX_BOUNTY_REWARD_BP, type ExtendedBounty } from "@marksman/contracts";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBountyContribution } from "@/hooks/useBountyContribution";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { InfoSection } from "@/components/ui/InfoSection";

type Props = {
  bounty: ExtendedBounty;
  balance: number;
  refresh: () => Promise<void>;
};

function ContributionForm({ bounty, balance, refresh }: Props) {
  const [expanded, setExpanded] = useState(false);
  const funding = useBountyContribution(bounty.id, refresh);
  const amount = Number(funding.amount);
  const validAmount =
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= MAX_BOUNTY_REWARD_BP;
  const fee = validAmount ? Math.ceil(amount / 10) : 0;
  const remaining = MAX_BOUNTY_REWARD_BP - bounty.rewardBp;
  const validation = !validAmount
    ? "Enter a whole number of BP greater than zero."
    : amount > remaining
      ? `This bounty can accept up to ${remaining.toLocaleString()} more BP.`
      : amount + fee > balance
        ? "You don't have enough BP to cover the contribution and fee."
        : null;
  const isOpen = bounty.status === "open";

  if (!isOpen && !funding.retrying && !funding.saved && !funding.pending)
    return null;
  if (!expanded)
    return isOpen ? (
      <Button
        size="lg"
        onClick={() => setExpanded(true)}
        disabled={remaining <= 0}
      >
        <span
          aria-hidden="true"
          className="inline-block size-[18px] shrink-0 bg-current"
          style={{ mask: "url('/images/bp-coin.svg') center / contain no-repeat" }}
        />
        {remaining <= 0 ? "Reward limit reached" : "Fund bounty"}
      </Button>
    ) : null;

  return (
    <InfoSection title="Fund bounty">
      {funding.complete ? (
        <div className="flex flex-col gap-3 py-2">
          <p role="status">Added {amount.toLocaleString()} BP to the bounty.</p>
          {isOpen && remaining > 0 ? (
            <Button onClick={funding.reset}>Add another contribution</Button>
          ) : null}
        </div>
      ) : (
        <form
          className="flex w-full flex-col gap-3 py-2 text-left"
          onSubmit={(event) => {
            event.preventDefault();
            if (funding.retrying || (!validation && isOpen))
              void funding.submit();
          }}
        >
          <label htmlFor="contribution-amount">Contribution (BP)</label>
          <TextInput
            id="contribution-amount"
            type="number"
            min={1}
            step={1}
            value={funding.amount}
            disabled={funding.pending || funding.saved}
            onChange={(event) => funding.setAmount(event.target.value)}
            aria-describedby="contribution-cost contribution-terms"
          />
          <p id="contribution-cost" className="text-sm" aria-live="polite">
            Contribution: {validAmount ? amount.toLocaleString() : "—"} BP ·
            Fee: {validAmount ? fee.toLocaleString() : "—"} BP · Total debit:{" "}
            {validAmount ? (amount + fee).toLocaleString() : "—"} BP
          </p>
          <p className="text-sm">
            Balance: {balance.toLocaleString()} BP · Reward limit:{" "}
            {MAX_BOUNTY_REWARD_BP.toLocaleString()} BP
          </p>
          <p id="contribution-terms" className="text-sm">
            Contributions cannot be withdrawn. Cancellation refunds your
            contribution, excluding fees.
          </p>
          {validation &&
          funding.amount &&
          !funding.retrying &&
          !funding.saved ? (
            <p className="text-sm text-danger">{validation}</p>
          ) : null}
          {funding.error ? (
            <p role="alert" className="text-danger">
              {funding.error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="accent"
            disabled={
              funding.pending ||
              (!funding.retrying && (!!validation || !isOpen))
            }
          >
            {funding.pending
              ? "Saving..."
              : funding.saved
                ? "Retry refresh"
                : funding.retrying
                  ? "Retry contribution"
                  : "Confirm contribution"}
          </Button>
        </form>
      )}
    </InfoSection>
  );
}

export default function BountyFunding({
  bounty,
  refresh,
}: {
  bounty: ExtendedBounty;
  refresh: () => Promise<void>;
}) {
  const { user, refreshBalance } = useAuth();
  if (!user) return null;
  return (
    <ContributionForm
      key={`${user.identity.id}:${bounty.id}`}
      bounty={bounty}
      balance={user.stats.bpBalance}
      refresh={async () => {
        const results = await Promise.allSettled([refresh(), refreshBalance()]);
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
      }}
    />
  );
}
