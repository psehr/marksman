type HuntControlsProps = {
  isHunting: boolean;
  count: number;
  loading: boolean;
  pending: boolean;
  ready: boolean;
  error: string | null;
  onToggle: () => void;
  onRefresh: () => void;
};

/** Presentation only: change markup/styles here without changing requests. */
export default function HuntControls({
  isHunting, count, loading, pending, ready, error, onToggle, onRefresh,
}: HuntControlsProps) {
  return (
    <div className="flex flex-col items-center gap-3" aria-busy={loading || pending}>
      {loading ? <p role="status">Loading hunts...</p> : null}
      {!loading && ready ? (
        <>
          <p role="status">{isHunting ? "You are hunting this bounty." : "Start hunting before finishing a qualifying play."}</p>
          <p className="text-sm">{count} active hunt(s)</p>
          <p className="text-sm">Scores finished while hunting are checked automatically. Stopping keeps earlier attempts eligible.</p>
          <button type="button" onClick={onToggle} disabled={pending}
            className="rounded bg-sky-700 px-4 py-2 disabled:opacity-50">
            {pending ? (isHunting ? "Stopping..." : "Starting...") : (isHunting ? "Stop Hunt" : "Start Hunt")}
          </button>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={onRefresh} disabled={loading || pending}
        className="text-sm underline disabled:opacity-50">Reload hunts</button>
    </div>
  );
}
