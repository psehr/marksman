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
      <div className="flex gap-2 place-content-center">
        <p>The following</p>
        <p className="text-accent">beatmap</p>
        <p>must be played</p>
      </div>
      <BeatmapCard beatmapMetadata={bounty.beatmap} />
    </div>
  ) : null;
}
