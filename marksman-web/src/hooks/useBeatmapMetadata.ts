import { getBeatmap } from "@/lib/api/beatmaps";
import { OsuBeatmapMetadata } from "@marksman/contracts";
import { ApiError } from "@/lib/api/client";
import { useEffect, useState } from "react";

export function useBeatmapMetadata(beatmapId: number | undefined) {
  const [beatmapMetadata, setBeatmapMetadata] =
    useState<OsuBeatmapMetadata | null>(null);
  const [beatmapLookupStatus, setBeatmapLookupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [beatmapLookupError, setBeatmapLookupError] = useState<string | null>(
    null,
  );
  const [beatmapLookupAttempt, setBeatmapLookupAttempt] = useState(0);

  const retryLookup = () => {
    setBeatmapLookupAttempt((previous) => previous + 1);
  };

  useEffect(() => {
    let ignore = false;

    setBeatmapMetadata(null);
    setBeatmapLookupError(null);

    if (beatmapId === undefined) {
      setBeatmapLookupStatus("idle");
      return;
    }

    setBeatmapLookupStatus("loading");

    const timer = window.setTimeout(() => {
      async function load() {
        try {
          if (beatmapId === undefined) return;
          const beatmapMetadata = await getBeatmap(beatmapId.toString());

          if (!ignore) {
            setBeatmapMetadata(beatmapMetadata);
            setBeatmapLookupStatus("success");
          }
        } catch (error) {
          if (!ignore) {
            if (error instanceof ApiError && error.status === 404) {
              setBeatmapLookupError(
                "Beatmap not found. Check the difficulty ID.",
              );
            } else {
              setBeatmapLookupError(
                "Unable to retrieve beatmap metadata. Please try again.",
              );
            }

            setBeatmapLookupStatus("error");
          }
        }
      }

      void load();
    }, 300);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [beatmapId, beatmapLookupAttempt]);

  return {
    beatmapMetadata,
    beatmapLookupStatus,
    beatmapLookupError,
    retryLookup,
  };
}
