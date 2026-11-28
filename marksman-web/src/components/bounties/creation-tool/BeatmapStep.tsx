import Button from "@/components/ui/Button";
import type { BeatmapStepProps } from "./creation-tool.types";
import BeatmapSearch from "./BeatmapSearch";
import { BeatmapCard } from "@/components/beatmaps/BeatmapCard";
import { osuBeatmapMetadatatoBountyBeatmapMetadata } from "@marksman/contracts";

export default function BeatmapStep({ props }: { props: BeatmapStepProps }) {
  const beatmapMetadata = props.beatmapMetadata
    ? osuBeatmapMetadatatoBountyBeatmapMetadata(props.beatmapMetadata)
    : undefined;

  let statusNotice;

  if (props.beatmapValidity.status === "valid") {
    statusNotice = (
      <>
        <p>
          Game mode is{" "}
          <span className="font-bold text-success">osu!standard</span>. ✅
        </p>
        <p>
          Beatmap status is{" "}
          <span className="font-bold text-success">
            {beatmapMetadata?.stats.status}
          </span>
          . ✅
        </p>
      </>
    );
  } else if (
    props.beatmapLookupStatus === "error" ||
    props.beatmapLookupStatus === "success"
  ) {
    statusNotice = (
      <>
        {props.beatmapValidity.reasons.map((reason) => (
          <p className="text-danger font-bold" role="alert" key={reason}>
            {reason} ❌
          </p>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <BeatmapSearch onSelect={props.onBeatmapSelect} />
      {beatmapMetadata ? (
        <div className="flex flex-col gap-2 w-full min-w-0">
          <BeatmapCard beatmapMetadata={beatmapMetadata} />
          <div className="flex flex-col text-foreground-muted text-xs gap-1">
            {statusNotice}
          </div>
        </div>
      ) : null}

      {props.beatmapLookupStatus === "loading" ? (
        <p role="status">Looking up beatmap...</p>
      ) : null}
      {props.beatmapLookupError ? (
        <div className="flex flex-col gap-2 text-xs">
          <Button onClick={props.retryLookup}>Retry</Button>
          <p className="text-danger font-bold" role="alert">
            {props.beatmapLookupError}
          </p>
        </div>
      ) : null}
    </div>
  );
}
