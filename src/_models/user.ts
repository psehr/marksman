export const newUser = (osuUser: OsuUser, cover_url: string) => {
  return {
    creation_timestamp: Date.now(),
    last_created_bounty_timestamp: 0,
    id: osuUser.id,
    name: osuUser.name,
    avatar: osuUser.image,
    cover: cover_url,
    country_code: osuUser.country_code,
    gain_multiplier: 1,
    current_gold: 0,
    xp_rank_tier: MARKSMAN_TIERS[0],
    total_xp: 0,
    xp_level: 0,
    completed_bounties_id: [],
    created_bounties_id: [],
    stats: {
      completed_bounties_amount: 0,
      created_bounties_amount: 0,
      completed_created_bounties_amount: 0,
      gold_spent: 0,
      gold_awarded: 0,
    },
  } as MarksmanUser;
};

export type MarksmanUser = {
  creation_timestamp: number;
  last_created_bounty_timestamp: number;
  id: number;
  name: string;
  avatar: string;
  cover: string;
  country_code: string;
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
  country_code: string;
};
