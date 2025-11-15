import { BeatmapVersion } from "../_models/beatmap";
import { Bounty, ClaimAttempt, ClaimResults } from "../_models/bounty";
import { Mod, OsuScore } from "../_models/score";
import { OsuUser } from "../_models/user";

/**
 * Validates/invalidates each bounty requirement needed for its completion.
 * @param bounty The {@link Bounty} that will be compared against.
 * @param score_data The {@link OsuScore} that will be checked.
 * @param user_id The integer user_id of the user trying to claim the bounty.
 * @returns A fully processed {@link ClaimResults} object.
 */
export function claimValidation(
  bounty: Bounty,
  score_data: OsuScore,
  user_id: number
): ClaimResults {
  return {
    isFC: isAnFC(score_data, bounty.version, bounty.sliderend_leniency),
    isClear: isAClear(score_data),
    hasRequiredMods: hasRequiredMods(score_data, bounty.required_mods),
    lacksDisallowedMods: lacksDisallowedMods(
      score_data,
      bounty.disallowed_mods
    ),
    isValidBeatmap: bounty.version.id == score_data.beatmap_id,
    isValidUser: user_id == score_data.user_id,
    isTimestampValid: score_data.timestamp > bounty.timestamp,
  };
}

/**
 * Checks if an osu! score is an FC, according to the selected combo leniency.
 * @param score The {@link OsuScore} to be checked.
 * @param beatmap The {@link BeatmapVersion} that was played.
 * @param leniency The allowed integer leniency for the score to be considered an FC.
 * @returns A boolean that is **true if the score is an FC**, false otherwise.
 */
export function isAnFC(
  score: OsuScore,
  beatmap: BeatmapVersion,
  leniency: number
) {
  const combo = score.combo;
  const max_combo = beatmap.attributes.max_combo;
  const min_combo_for_fc = max_combo - leniency;

  return combo >= min_combo_for_fc;
}

/**
 * Checks if an osu! score is a clear, and does not includes NoFail.
 * @param score The {@link OsuScore} to be checked.
 * @returns A boolean that is **true if the score is a clear**, false otherwise.
 */
export function isAClear(score: OsuScore) {
  return score.pass && !score.mods.includes("nf");
}

/**
 * Checks if an osu! score includes at least the required mods array.
 * @param score The {@link OsuScore} to be checked.
 * @param required_mods The required {@link Mod} object array.
 * @returns A boolean that is **true if the score includes every required mod**, false otherwise.
 */
export function hasRequiredMods(score: OsuScore, required_mods: Mod[]) {
  let isValid = true;
  required_mods.forEach((required_mod) => {
    score.mods.includes(required_mod) ? null : (isValid = false);
  });
  return isValid;
}

/**
 * Checks if an osu! score does not include the disallowed mods array.
 * @param score The {@link OsuScore} to be checked.
 * @param disallowed_mods The disallowed {@link Mod} object array.
 * @returns A boolean that is **true if the score does not include every disallowed mod**, false otherwise.
 */
export function lacksDisallowedMods(score: OsuScore, disallowed_mods: Mod[]) {
  let isValid = true;
  disallowed_mods.forEach((disallowed_mod) => {
    score.mods.includes(disallowed_mod) ? (isValid = false) : null;
  });
  return isValid;
}
