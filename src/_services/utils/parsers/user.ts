import { MarksmanUser } from "@/src/_models/user";

export function parseUserFromFirestoreDocument(
  raw_user: FirebaseFirestore.DocumentData
): MarksmanUser {
  const d = raw_user;
  return {
    creation_timestamp: d.creation_timestamp,
    last_created_bounty_timestamp: d.last_created_bounty_timestamp,
    id: d.id,
    name: d.name,
    avatar: d.avatar,
    cover: d.cover,
    country_code: d.country_code,
    gain_multiplier: d.gain_multiplier,
    current_gold: d.current_gold,
    xp_rank_tier: d.xp_rank_tier,
    total_xp: d.total_xp,
    xp_level: d.xp_level,
    completed_bounties_id: [], // TODO
    created_bounties_id: [], // TODO
    stats: {
      completed_bounties_amount: d.stats.completed_bounties_amount,
      created_bounties_amount: d.stats.created_bounties_amount,
      completed_created_bounties_amount:
        d.stats.completed_created_bounties_amount,
      gold_spent: d.stats.gold_spent,
      gold_awarded: d.stats.gold_awarded,
    },
  } as MarksmanUser;
}

export function parseUserIdFromImageUrl(url: string) {
  return url.split("/")[3].split("?")[0];
}
