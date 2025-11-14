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
  color: string;
};

export type MarksmanTitle =
  | "Beginner Hunter"
  | "Hunter"
  | "Pro Hunter"
  | "Legendary Hunter"
  | "Mythic Hunter";

export const MARKSMAN_TIERS: MarksmanTier[] = [
  { title: "Beginner Hunter", rank_percentile: 100, color: "gray-400" },
  { title: "Hunter", rank_percentile: 40, color: "blue-400" },
  { title: "Pro Hunter", rank_percentile: 10, color: "purple-400" },
  { title: "Legendary Hunter", rank_percentile: 2, color: "gold-400" },
  { title: "Mythic Hunter", rank_percentile: 0.5, color: "red-400" },
];

export type OsuUser = {
  name: string;
  id: number;
  image: string;
  country_code: string;
};
