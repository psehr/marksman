import Button from "../ui/Button";

export function DailyClaim({
  claimed,
  claimPending,
  claimMessage,
  claimError,
  claimDailyReward,
}: {
  claimed: boolean;
  claimPending: boolean;
  claimMessage: string | null;
  claimError: string | null;
  claimDailyReward: () => void;
}) {
  return (
    <div className="text-right">
      <Button
        type="button"
        variant="accent"
        disabled={claimPending || claimed}
        onClick={() => void claimDailyReward()}
      >
        {claimPending
          ? "Claiming…"
          : claimed
            ? "Daily BP claimed"
            : "Claim daily 25 BP"}
      </Button>
      {claimMessage ? <p role="status">{claimMessage}</p> : null}
      {claimError ? <p role="alert">{claimError}</p> : null}
    </div>
  );
}
