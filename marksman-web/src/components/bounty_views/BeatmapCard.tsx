import { aes_font } from "@/lib/fonts";
import Image from "next/image";
import { BountyBeatmapMetadata } from "@marksman/contracts";
import Link from "next/link";

function formatBeatmapLength(length: number): string {
  const hours = Math.floor(length / 3600);
  const minutes = Math.floor((length % 3600) / 60);
  const seconds = length % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  } else {
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
}

export function BeatmapCard({
  beatmapMetadata,
  variant = "beatmap",
}: {
  beatmapMetadata: BountyBeatmapMetadata | null;
  variant?: "bounty" | "beatmap";
}) {
  const coverUrl = beatmapMetadata?.covers?.cover;
  const title = `${beatmapMetadata?.song?.title ?? "title"}`;
  const artist = `${beatmapMetadata?.song?.artist ?? "artist"}`;
  const version = `${beatmapMetadata?.version.name ?? "version"}`;
  const mapper = `${beatmapMetadata?.creator?.username ?? "mapper"}`;
  const mapUrl = `${beatmapMetadata?.url}`;

  switch (variant) {
    case "bounty":
      return (
        <div className="relative h-24 overflow-hidden">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt="Beatmap Cover"
              fill
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-black/50" aria-hidden></div>
          <div
            className="to-card absolute inset-0 bg-linear-to-b from-transparent"
            aria-hidden="true"
          />
          <div
            className={`relative z-10 gap-4 ${aes_font.className} flex size-full p-2 px-4`}
          >
            <div className="flex min-w-0 flex-[2] flex-col">
              <p className="text-accent truncate text-lg font-bold">{title}</p>
              <p className="text-foreground-muted truncate text-sm italic">
                {artist}
              </p>
            </div>
            <div className="flex min-w-0 flex-[1] flex-col text-end">
              <p className="text-accent truncate text-lg font-bold">
                [ {version} ]
              </p>
              <p className="text-foreground-muted truncate text-sm italic">
                {mapper}
              </p>
            </div>
          </div>
        </div>
      );
    case "beatmap":
      return (
        <Link
          className="relative block h-24 overflow-hidden rounded border border-border"
          href={mapUrl}
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt="Beatmap Cover"
              fill
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-black/60" aria-hidden></div>
          <div
            className={`relative z-10 gap-4 ${aes_font.className} flex size-full p-2 px-4`}
          >
            <div className="flex min-w-0 flex-[2] flex-col text-left">
              <p className="text-accent truncate text-lg font-bold">{title}</p>
              <p className="text-foreground-muted truncate text-sm italic">
                {artist}
              </p>
              <div className="flex gap-2 text-foreground-muted">
                <p>
                  {formatBeatmapLength(
                    beatmapMetadata?.specs.length.drain ?? 0,
                  )}
                </p>
                <span>•</span>
                <p>{beatmapMetadata?.specs.bpm}BPM</p>
                <span>•</span>
                <p>CS{beatmapMetadata?.specs.cs}</p>
                <span>•</span>
                <p>HP{beatmapMetadata?.specs.hp}</p>
                <span>•</span>
                <p>OD{beatmapMetadata?.specs.od}</p>
                <span>•</span>
                <p>AR{beatmapMetadata?.specs.ar}</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-[1] flex-col text-end">
              <p className="text-accent truncate text-lg font-bold">
                [ {version} ]
              </p>
              <p className="text-foreground-muted truncate text-sm italic">
                {mapper}
              </p>
              <p className="text-xl text-foreground-muted">
                {beatmapMetadata?.specs.sr.toFixed(2)}★
              </p>
            </div>
          </div>
        </Link>
      );
  }
}
