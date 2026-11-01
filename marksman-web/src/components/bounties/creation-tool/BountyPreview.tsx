import { BountyCardContent, BountyCardDisplay } from "../BountyCard";

export default function BountyPreview({
  content,
}: {
  content: BountyCardDisplay;
}) {
  const status = (
    <p className="text-foreground-muted text-xs">
      This is a preview of the future bounty.
    </p>
  );

  return (
    <div className="bg-card border-border relative isolate flex w-full min-w-0 flex-col overflow-hidden rounded border">
      <BountyCardContent content={content} status={status} />
    </div>
  );
}
