import Button from "@/components/ui/Button";

type HuntControlsProps = {
  isHunting: boolean;
  loading: boolean;
  pending: boolean;
  ready: boolean;
  error: string | null;
  onToggle: () => void;
  onRefresh: () => void;
};

/** Compact action with recovery feedback; request state lives in useHunt. */
export default function HuntControls({
  isHunting,
  loading,
  pending,
  ready,
  error,
  onToggle,
  onRefresh,
}: HuntControlsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2" aria-busy={loading || pending}>
      {loading || ready ? (
        <Button
          size="lg"
          variant="accent"
          className="w-full"
          onClick={onToggle}
          disabled={loading || pending}
        >
          {loading
            ? "Loading hunt..."
            : pending
              ? isHunting
                ? "Stopping..."
                : "Starting..."
              : isHunting
                ? "Stop Hunt"
                : "Start Hunt"}
        </Button>
      ) : (
        <Button
          size="lg"
          variant="accent"
          className="w-full"
          onClick={onRefresh}
          disabled={pending}
        >
          Reload hunts
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
