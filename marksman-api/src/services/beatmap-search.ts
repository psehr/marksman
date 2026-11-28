import {
  BeatmapSearchRequest,
  BeatmapSearchResponse,
} from "@marksman/contracts";
import { fetchOsuBeatmapsetSearch } from "../integrations/osu/beatmap-search";

export async function searchBeatmaps(
  request: BeatmapSearchRequest,
): Promise<BeatmapSearchResponse> {
  const response = await fetchOsuBeatmapsetSearch(
    request.query,
    request.cursor,
  );

  return {
    beatmapsets: response.beatmapsets,
    total: response.total,
    cursor: response.cursor_string,
  };
}
