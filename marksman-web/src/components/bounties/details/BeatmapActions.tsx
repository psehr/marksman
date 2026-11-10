import ActionIcon from "@/components/ui/ActionIcon";
import type { ExtendedBounty } from "@marksman/contracts";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import { getBeatmapDownloadUrl } from "@/lib/beatmap-links";

export default function BeatmapActions({ bounty }: { bounty: ExtendedBounty }) {
  const downloadUrl = getBeatmapDownloadUrl(bounty.beatmap);
  return (
    <>
      <ButtonLink
        size="lg"
        variant="primary"
        href={`osu://b/${bounty.goal.beatmapId}`}
      >
        <ActionIcon action="osu" />
        Open in osu!
      </ButtonLink>
      {downloadUrl ? (
        <ButtonLink
          size="lg"
          variant="primary"
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ActionIcon action="download" />
          Download on osu!
        </ButtonLink>
      ) : (
        <Button
          size="lg"
          variant="primary"
          disabled
          title="Beatmap set information is unavailable."
        >
          <ActionIcon action="download" />
          Download on osu!
        </Button>
      )}
    </>
  );
}
