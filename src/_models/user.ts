export type MarksmanUser = {
  creation_timestamp: number;
  last_created_bounty_timestamp: number;
  id: number;
  name: string;
  avatar: string;
  gain_multiplier: number;
  current_gold: number;
  xp_rank_tier: MarksmanTier;
  total_xp: number;
  xp_level: number;
  completed_bounties_id: string[];
  created_bounties_id: string[];
  stats: {
    completed_bounties_amount: number;
    created_bounties_amount: number;
    completed_created_bounties_amount: number;
    gold_spent: number;
    gold_awarded: number;
  };
};

export type MarksmanTier = {
  title: MarksmanTitle;
  rank_percentile: number;
};

export type MarksmanTitle =
  | "Peasant"
  | "Squire"
  | "Knight"
  | "Baron"
  | "Duke"
  | "King";

export const MARKSMAN_TIERS: MarksmanTier[] = [
  { title: "Peasant", rank_percentile: 100 },
  { title: "Squire", rank_percentile: 75 },
  { title: "Knight", rank_percentile: 40 },
  { title: "Baron", rank_percentile: 10 },
  { title: "Duke", rank_percentile: 2 },
  { title: "King", rank_percentile: 0.5 },
];

export type OsuUser = {
  name: string;
  id: number;
  image: string;
};
