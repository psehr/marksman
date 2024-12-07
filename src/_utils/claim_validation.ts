import { BeatmapVersion } from "../_models/beatmap";
import { Bounty, ClaimAttempt, ClaimResults } from "../_models/bounty";
import { Mod, OsuScore } from "../_models/score";
import { OsuUser } from "../_models/user";

export function claimValidation(
  bounty: Bounty,
  score_data: OsuScore,
  user: OsuUser
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
    isValidUser: user.id == score_data.user_id,
    isTimestampValid: score_data.timestamp > bounty.timestamp,
  };
}
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
export function isAClear(score: OsuScore) {
  return score.pass && !score.mods.includes("nf");
}
export function hasRequiredMods(score: OsuScore, required_mods: Mod[]) {
  let isValid = true;
  required_mods.forEach((required_mod) => {
    score.mods.includes(required_mod) ? null : (isValid = false);
  });
  return isValid;
}

export function lacksDisallowedMods(score: OsuScore, disallowed_mods: Mod[]) {
  let isValid = true;
  disallowed_mods.forEach((disallowed_mod) => {
    score.mods.includes(disallowed_mod) ? (isValid = false) : null;
  });
  return isValid;
}
