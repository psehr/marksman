import Button from "@/components/ui/Button";
import type { BeatmapStepProps } from "./BountyCreationTool";
import TextInput from "@/components/ui/TextInput";
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
          ✅ Game mode is{" "}
          <span className="font-bold text-success">osu!standard</span>. ✅
        </p>
        <p>
          ✅ Beatmap is{" "}
          <span className="font-bold text-success">
            Ranked, Loved or Approved
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
            ❌ {reason} ❌
          </p>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <TextInput
        aria-label="beatmap input"
        value={props.beatmapInput}
        onChange={(event) => props.onBeatmapChange(event.target.value)}
        className="px-2"
        size="xl"
        placeholder="Enter beatmap URL or ID here..."
      />
      {beatmapMetadata ? (
        <div className="flex flex-col gap-2">
          <p className="font-bold">You selected:</p>
          <BeatmapCard beatmapMetadata={beatmapMetadata} />
          <div className="flex flex-col text-foreground-muted text-xs gap-1">
            {statusNotice}
          </div>
        </div>
      ) : null}

      {props.beatmapInput.trim() && props.invalidInput ? (
        <p className="text-xs text-danger font-bold" role="alert">
          ❌ Invalid URL/ID input provided. ❌
        </p>
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
      <div className="flex gap-4">
        <Button onClick={props.onBack} variant="outline">
          Back
        </Button>
        {props.beatmapValidity.status === "valid" ? (
          <Button onClick={props.onContinue} variant="accent">
            Continue
          </Button>
        ) : null}
      </div>
    </div>
  );
}
