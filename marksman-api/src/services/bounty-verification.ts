import {
  OsuBeatmapMetadata,
  Bounty,
  BountyCompletionValidity,
  OsuGrade,
  ScoreResponse,
  UserIdentity,
} from "@marksman/contracts";
import { InvalidBeatmapMetadataError } from "./errors";

const gradeStrength: Readonly<Record<OsuGrade, number>> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
  SH: 5,
  X: 6,
  XH: 6,
};

export function isBountyCompletionValid(
  bountyCompletionValidity: BountyCompletionValidity,
): boolean {
  return Object.values(bountyCompletionValidity).every(
    (value) => value === undefined || value === true,
  );
}

export function evaluateBountyCompletion(
  score: ScoreResponse,
  bounty: Bounty,
  identity: UserIdentity,
  goalBeatmapMetadata: OsuBeatmapMetadata,
): BountyCompletionValidity {
  const bountyValidity: BountyCompletionValidity = {
    playerIsClaimant: isPlayerClaimant(score, identity),

    bountyIsClaimable: isBountyClaimable(bounty),

    playerIsNotOwner: isPlayerNotBountyOwner(score, bounty),

    beatmapIsCorrect: isCorrectBeatmap(score, bounty),

    rulesetIsCorrect: isCorrectRuleset(score),

    scoreIsSetAfterCreation: isScoreSetAfterBountyCreation(score, bounty),

    scoreIsPassed: isPassed(score),

    scoreAccuracyIsSatisfied:
      bounty.goal.minimumAccuracy !== undefined
        ? isAccuracySatisfied(score, bounty)
        : undefined,

    modsAreCorrect: isCorrectMods(score, bounty),

    fcIsSatisfied:
      bounty.goal.type === "full_combo"
        ? isConsideredAnFc(
            score,
            bounty.goal.minimumComboRatio,
            goalBeatmapMetadata.max_combo,
          )
        : undefined,

    gradeIsSatisfied:
      bounty.goal.type === "minimum_grade"
        ? isGradeSatisfied(score, bounty)
        : undefined,
  };

  return bountyValidity;
}

function isConsideredAnFc(
  score: ScoreResponse,
  minimumComboRatio?: number,
  beatmapMaxCombo?: number,
): boolean {
  const clientType = score.legacy_score_id ? "stable" : "lazer";

  const missCount = score.statistics.miss ?? 0;
  const largeTickMissCount = score.statistics.large_tick_miss ?? 0;
  const comboBreakCount = score.statistics.combo_break ?? 0;

  switch (clientType) {
    case "stable":
      if (!beatmapMaxCombo || beatmapMaxCombo <= 0)
        throw new InvalidBeatmapMetadataError();

      const obtainedRatio = score.max_combo / beatmapMaxCombo;
      const ratioIsValid =
        obtainedRatio >= (minimumComboRatio ? minimumComboRatio : 0.99);

      return ratioIsValid && missCount === 0;

    case "lazer":
      return (
        comboBreakCount === 0 && largeTickMissCount === 0 && missCount === 0
      );
  }
}

function isPlayerClaimant(
  score: ScoreResponse,
  identity: UserIdentity,
): boolean {
  return score.user_id === identity.osuUserId;
}

function isBountyClaimable(bounty: Bounty): boolean {
  return bounty.status === "open";
}

function isPlayerNotBountyOwner(score: ScoreResponse, bounty: Bounty): boolean {
  return score.user_id !== bounty.creatorOsuUserId;
}

function isCorrectBeatmap(score: ScoreResponse, bounty: Bounty): boolean {
  return score.beatmap_id === bounty.goal.beatmapId;
}

function isCorrectRuleset(score: ScoreResponse): boolean {
  // "0" is the ruleset id for osu! standard
  return score.ruleset_id === 0;
}

function isScoreSetAfterBountyCreation(
  score: ScoreResponse,
  bounty: Bounty,
): boolean {
  return Date.parse(score.ended_at) > Date.parse(bounty.createdAt);
}

function isPassed(score: ScoreResponse): boolean {
  return score.passed;
}

function isAccuracySatisfied(score: ScoreResponse, bounty: Bounty): boolean {
  const minimumAccuracy = bounty.goal.minimumAccuracy ?? 0;

  return score.accuracy >= minimumAccuracy / 100;
}

function isCorrectMods(score: ScoreResponse, bounty: Bounty): boolean {
  const modsAcronyms = score.mods.map((mod) => {
    return mod.acronym;
  });

  switch (bounty.goal.modRequirement.rule) {
    case "any":
      return true;
    case "exact":
      if (bounty.goal.modRequirement.mods.length !== modsAcronyms.length)
        return false;
      return bounty.goal.modRequirement.mods.every((mod) =>
        modsAcronyms.includes(mod),
      );
    case "excludes":
      return bounty.goal.modRequirement.mods.every(
        (mod) => !modsAcronyms.includes(mod),
      );
    case "includes":
      return bounty.goal.modRequirement.mods.every((mod) =>
        modsAcronyms.includes(mod),
      );
  }
}

function isGradeSatisfied(score: ScoreResponse, bounty: Bounty): boolean {
  if (bounty.goal.type !== "minimum_grade") return true;

  const achievedGrade = score.rank;

  return (
    gradeStrength[achievedGrade] >=
    gradeStrength[bounty.goal.minimumGradeRequirement]
  );
}
