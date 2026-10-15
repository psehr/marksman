import type {
  OsuBeatmapMetadata,
  Bounty,
  ScoreResponse,
  UserIdentity,
} from "@marksman/contracts";

export const hunter: UserIdentity = {
  id: "22222222-2222-4222-8222-222222222222",
  osuUserId: 42,
  username: "hunter",
};
export const metadata: OsuBeatmapMetadata = {
  id: 123456,
  ar: 9, accuracy: 8, cs: 4, drain: 6,
  total_length: 120, hit_length: 110, playcount: 1000,
  checksum: "0123456789abcdef0123456789abcdef",
  version: "Hard",
  difficulty_rating: 3.5,
  mode: "osu",
  status: "ranked",
  bpm: 180,
  max_combo: 1000,
  url: "https://osu.ppy.sh/beatmaps/123456",
  beatmapset: null,
};
export function qualifyingBounty(): Bounty {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "open",
    rewardBp: 30,
    completedByOsuUserId: null,
    completionScoreId: null,
    completedAt: null,
    cancelledAt: null,
    creatorOsuUserId: 7,
    createdAt: "2026-09-21T12:00:00.000Z",
    goal: {
      type: "full_combo",
      beatmapId: 123456,
      beatmapChecksum: null,
      modRequirement: { rule: "any" },
    },
  };
}
export function qualifyingScore(): ScoreResponse {
  return {
    id: 987654,
    user_id: hunter.osuUserId,
    beatmap_id: 123456,
    ruleset_id: 0,
    legacy_score_id: null,
    ended_at: "2026-09-21T12:01:00Z",
    accuracy: 0.99,
    mods: [],
    rank: "S",
    max_combo: 990,
    statistics: { miss: 0, large_tick_miss: 0, combo_break: 0 },
    passed: true,
    beatmap: {
      version: metadata.version,
      difficulty_rating: metadata.difficulty_rating,
      max_combo: metadata.max_combo,
    },
    beatmapset: null,
  };
}
