import { ExtendedBounty } from "@marksman/contracts";
import Link from "next/link";

export default function BeatmapRequirement({
  bounty,
}: {
  bounty: ExtendedBounty;
}) {
  const mapUrl = `https://osu.ppy.sh/beatmaps/${bounty?.goal.beatmapId}`;

  return (
    <>
      {bounty.beatmap && bounty.beatmap.song && bounty.beatmap.specs ? (
        <div className="flex flex-row gap-2 place-content-center">
          <p>Score must be set on</p>
          <p className="italic font-bold truncate max-w-2/3">
            {bounty.beatmap.song.artist} - {bounty.beatmap.song.title} [
            {bounty.beatmap.version.name}]
          </p>
          <p>({bounty.beatmap.specs.sr.toFixed(2)}★)</p>
        </div>
      ) : (
        <p>Unavailable beatmap metadata</p>
      )}

      <Link href={mapUrl} className="bg-sky-700 px-4 py-2 rounded w-fit">
        osu! Beatmap Page
      </Link>
    </>
  );
}
