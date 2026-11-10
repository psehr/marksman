import Button from "../ui/Button";

export function DailyClaim({
  claimed,
  claimPending,
  claimStatusLoading,
  claimStatusError,
  refreshClaimStatus,
  claimMessage,
  claimError,
  claimDailyReward,
}: {
  claimed: boolean;
  claimPending: boolean;
  claimStatusLoading: boolean;
  claimStatusError: boolean;
  refreshClaimStatus: () => void;
  claimMessage: string | null;
  claimError: string | null;
  claimDailyReward: () => void;
}) {
  return (
    <div className="text-right">
      <Button
        type="button"
        variant="accent"
        disabled={claimPending || claimed || claimStatusLoading || claimStatusError}
        onClick={() => void claimDailyReward()}
      >
        {claimStatusLoading
          ? "Checking daily BP…"
          : claimPending
          ? "Claiming…"
          : claimed
            ? "Daily BP claimed"
            : "Claim daily 25 BP"}
      </Button>
      {claimStatusError ? (
        <div>
          <p role="alert">Could not check your daily reward.</p>
          <Button onClick={refreshClaimStatus}>Retry daily status</Button>
        </div>
      ) : null}
      {claimMessage ? <p role="status">{claimMessage}</p> : null}
      {claimError ? <p role="alert">{claimError}</p> : null}
    </div>
  );
}
