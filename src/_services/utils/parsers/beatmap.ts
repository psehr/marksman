import { BeatmapSet, BeatmapStatus, BeatmapVersion } from "@models/beatmap";
import { beatmaps_details_set_response } from "osu-api-extended/dist/types/v2/beatmaps_details_set";
import { SearchBeatmaps } from "osu-api-extended/dist/types/v2/search_all";

export function parseBeatmapsetFromOsuApiBeatmap(
  raw_api_beatmap: beatmaps_details_set_response
) {
  let parsedBeatmap: BeatmapSet = {
    id: raw_api_beatmap.id,
    url: `https://osu.ppy.sh/beatmapsets/${raw_api_beatmap.id}#osu`,
    metadata: {
      title: raw_api_beatmap.title,
      titleUnicode: raw_api_beatmap.title_unicode,
      artist: raw_api_beatmap.artist,
      artistUnicode: raw_api_beatmap.artist_unicode,
    },
    creator: {
      id: raw_api_beatmap.user_id,
      name: raw_api_beatmap.user.username,
      image: raw_api_beatmap.user.avatar_url,
      country_code: "",
    },
    status: raw_api_beatmap.status as BeatmapStatus,
    cover: raw_api_beatmap.covers["cover@2x"],
    slimcover: raw_api_beatmap.covers["slimcover@2x"],
    list: raw_api_beatmap.covers["list@2x"],
    card: raw_api_beatmap.covers["card@2x"],
    versions: [],
  };

  // populate versions

  for (let index = 0; index < raw_api_beatmap.beatmaps.length; index++) {
    const version = raw_api_beatmap.beatmaps[index];
    parsedBeatmap.versions.push({
      id: version.id,
      url: version.url,
      difficulty_name: version.version,
      metadata: parsedBeatmap.metadata,
      attributes: {
        star_rating: version.difficulty_rating,
        bpm: version.bpm,
        overall_difficulty: version.accuracy,
        approach_rate: version.ar,
        drain_length: version.drain,
        max_combo: version.max_combo,
      },
    });
  }

  return parsedBeatmap;
}

export function parseBeatmapsetsFromOsuApiSearch(
  raw_api_search: SearchBeatmaps
) {
  const sets = raw_api_search.beatmapsets;
  let parsedSets: BeatmapSet[] = [];

  for (let index = 0; index < sets.length; index++) {
    const set = sets[index];
    if (set.status != "graveyard") {
      let parsedBeatmap: BeatmapSet = {
        id: set.id,
        url: `https://osu.ppy.sh/beatmapsets/${set.id}#osu`,
        metadata: {
          title: set.title,
          titleUnicode: set.title_unicode,
          artist: set.artist,
          artistUnicode: set.artist_unicode,
        },
        creator: {
          id: set.user_id,
          image: "",
          name: set.creator,
          country_code: "",
        },
        status: set.status as BeatmapStatus,
        cover: set.covers["cover@2x"],
        slimcover: set.covers["slimcover@2x"],
        list: set.covers["list@2x"],
        card: set.covers["card@2x"],
        versions: [],
      };

      // populate beatmap versions
      set.beatmaps
        .sort((a, b) => b.difficulty_rating - a.difficulty_rating)
        .forEach((version) => {
          version.mode == "osu"
            ? parsedBeatmap.versions.push({
                id: version.id,
                url: version.url,
                difficulty_name: version.version,
                metadata: parsedBeatmap.metadata,
                attributes: {
                  star_rating: version.difficulty_rating,
                  bpm: version.bpm,
                  overall_difficulty: version.accuracy,
                  approach_rate: version.ar,
                  drain_length: version.drain,
                  max_combo: version.max_combo,
                },
              })
            : null;
        });

      parsedSets.push(parsedBeatmap);
    }
  }

  return parsedSets;
}
