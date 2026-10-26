import { ExtendedBounty } from "@marksman/contracts";
import { BeatmapCard } from "../bounty_views/BeatmapCard";
import { aes_font } from "@/lib/fonts";

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
    </div>
  ) : null;
}
