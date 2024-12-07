import { Bounty } from "../_models/bounty";

export function gold_to_experience(gold: number, days_elapsed: number) {
  const MIN_GOLD = 1000;
  const MAX_GOLD = 1000000;
  const MIN_DAYS_ELAPSED = 5;
  const MAX_DAYS_ELAPSED = 30;

  const BASE_XP_REWARD = 100;

  gold < MIN_GOLD ? (gold = MIN_GOLD) : null;
  gold > MAX_GOLD ? (gold = MAX_GOLD) : null;

  days_elapsed < MIN_DAYS_ELAPSED ? (days_elapsed = MIN_DAYS_ELAPSED) : null;
  days_elapsed > MAX_DAYS_ELAPSED ? (days_elapsed = MAX_DAYS_ELAPSED) : null;

  const TIME_ELAPSED_COEFFICIENT = 1 + (days_elapsed + 1) / MAX_DAYS_ELAPSED;
  const GOLD_COEFFICIENT = Math.pow(gold, 1.2) / 10 + BASE_XP_REWARD;

  const EXPERIENCE =
    Math.floor((GOLD_COEFFICIENT * TIME_ELAPSED_COEFFICIENT) / 10) * 10;
  return EXPERIENCE;
}

export function bounty_base_cost(bounty: Bounty) {
  const REQUIRED_MODS_COUNT_MALUS = bounty.required_mods.length * 1000;
  const DISALLOWED_MODS_COUNT_MALUS = bounty.disallowed_mods.length * 1000;
  let TYPE_MALUS = 0;
  switch (bounty.type) {
    case "Clear":
      TYPE_MALUS = 0;
      break;
    case "FC":
      TYPE_MALUS = 2000;
      break;
    default:
      break;
  }
  const LENIENCY_MALUS = bounty.sliderend_leniency * 100;
  const REWARD_MALUS = bounty.reward / 10;

  const SR =
    bounty.version.attributes.star_rating > 10
      ? 10
      : bounty.version.attributes.star_rating;
  const SR_MALUS = Math.pow(Math.log(SR), SR * 1.1);

  const COST_MULTIPLIER = 1;

  const COST =
    Math.round(
      (COST_MULTIPLIER *
        (REQUIRED_MODS_COUNT_MALUS +
          DISALLOWED_MODS_COUNT_MALUS +
          TYPE_MALUS +
          LENIENCY_MALUS +
          REWARD_MALUS +
          SR_MALUS)) /
        100
    ) * 100;

  return COST;
}
