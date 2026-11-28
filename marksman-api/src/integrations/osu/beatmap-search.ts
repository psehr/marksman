import { OsuApiError } from "../../services/errors";
import { getOsuAccessToken } from "./auth";

import { z } from "zod";
import { beatmapSearchResponseSchema } from "@marksman/contracts";

const osuBeatmapSearchResponseSchema = beatmapSearchResponseSchema
  .omit({ cursor: true })
  .extend({
    cursor_string: z.string().nullish(),
  });

export async function fetchOsuBeatmapsetSearch(
  query: string,
  cursor_string?: string,
) {
  try {
    const token = await getOsuAccessToken();

    const url = new URL("https://osu.ppy.sh/api/v2/beatmapsets/search");
    url.searchParams.append("q", query);
    url.searchParams.append("m", "0");
    if (cursor_string) url.searchParams.append("cursor_string", cursor_string);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "x-api-version": "20220705",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new OsuApiError();
    }

    const parsedSearchResponse = osuBeatmapSearchResponseSchema.parse(
      await response.json(),
    );

    const filteredSets = parsedSearchResponse.beatmapsets
      .map((set) => {
        return {
          ...set,
          beatmaps: set.beatmaps.filter(
            (map) =>
              ["ranked", "loved", "approved"].includes(map.status) &&
              map.mode === "osu",
          ),
        };
      })
      .filter((set) => set.beatmaps.length > 0);

    return { ...parsedSearchResponse, beatmapsets: filteredSets };
  } catch {
    throw new OsuApiError();
  }
}
