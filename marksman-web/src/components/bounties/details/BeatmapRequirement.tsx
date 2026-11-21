import { ExtendedBounty } from "@marksman/contracts";
import { BeatmapCard } from "@/components/beatmaps/BeatmapCard";
import { aes_font } from "@/lib/fonts";
import CopyText from "@/components/ui/CopyText";

export default function BeatmapRequirement({
  bounty,
}: {
  bounty: ExtendedBounty;
}) {
  return bounty.beatmap ? (
    <div
      className={`flex flex-col w-full p-2 gap-2 ${aes_font.className} font-bold`}
    >
      <p>
        The following <span className="text-accent">beatmap</span> must be
        played
      </p>
      <BeatmapCard beatmapMetadata={bounty.beatmap} />
      <CopyText
        key={bounty.goal.beatmapId}
        text={String(bounty.goal.beatmapId)}
        label="Copy Beatmap ID"
        icon="copy"
        copiedMessage="Beatmap ID copied!"
        errorMessage="Could not copy the beatmap ID. You can copy it below."
        fallbackLabel="Beatmap ID"
        size="sm"
      />
    </div>
  ) : null;
}
