import { BountyCardContent, BountyCardDisplay, bountyCardBorderStyle } from "../BountyCard";

export default function BountyPreview({
  content,
}: {
  content: BountyCardDisplay;
}) {
  const status = (
    <p className="text-foreground-muted text-xs">This is a bounty preview.</p>
  );

  return (
    <div
      className="bg-card border-[var(--bounty-tier-border,var(--color-border))] relative isolate flex w-full min-w-0 flex-col overflow-hidden rounded border"
      style={bountyCardBorderStyle(content.rewardBp)}
    >
      <BountyCardContent content={content} status={status} />
    </div>
  );
}
