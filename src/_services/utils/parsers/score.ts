import { OsuScore } from "@/src/_models/score";
import { Mod } from "@/src/_models/score";
import { scores_details_response } from "osu-api-extended/dist/types/v2/scores_details";

/**
 * Parses a mod array from the osu! API v2 definition of a mod array.
 * @param mods The osu! API v2 mod array answer.
 * @returns An alphabetically sorted {@link Mod} array.
 */
export function parseModsFromOsuMods(mods: { acronym: string }[]) {
  let parsedMods: Mod[] = [];
  mods.forEach((mod) => {
    parsedMods.push(mod.acronym.toLowerCase() as Mod);
  });

  return parsedMods.sort();
}

/**
 * Parses a score from an osu! API v2 score.
 * @param raw_api_score The osu! API v2 answer.
 * @returns An {@link OsuScore} object.
 */
export function parseOsuScoreFromOsuApiScore(
  raw_api_score: scores_details_response
) {
  const d = raw_api_score;
  let osuScore: OsuScore = {
    id: d.id,
    user: d.user.username,
    user_id: d.user_id,
    accuracy: d.accuracy * 100,
    pass: d.passed,
    combo: d.max_combo,
    mods: [],
    timestamp: new Date(d.ended_at).getTime(),
    beatmap_id: d.beatmap_id,
  };

  // populate mods

  parseModsFromOsuMods(d.mods).forEach((mod) => {
    osuScore.mods.push(mod);
  });
  return osuScore;
}
