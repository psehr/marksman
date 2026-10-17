import { BountyScoreCandidate, UserIdentity } from "@marksman/contracts";
import { db } from "../db";
import { findBountyById } from "../db/bounties";
import { BeatmapMetadataUnavailableError, BountyNotFoundError } from "./errors";
import { fetchRecentScores } from "../integrations/osu/scores";
import { getBeatmap } from "../integrations/osu/beatmaps";
import { evaluateBountyCompletion } from "./bounty-verification";

export async function getBountyRecentScores(
  bountyId: string,
  user: UserIdentity,
): Promise<BountyScoreCandidate[]> {
  const bounty = await findBountyById(db, bountyId);

  if (!bounty) throw new BountyNotFoundError();

  const recentScores = await fetchRecentScores(user.osuUserId);

  const filteredScores = recentScores.filter(
    (score) =>
      score.beatmap_id === bounty.goal.beatmapId &&
      Date.parse(score.ended_at) > Date.parse(bounty.createdAt),
  );

  if (!filteredScores.length) return [];

  const beatmapMetadata = await getBeatmap(bounty.goal.beatmapId).catch(() => {
    throw new BeatmapMetadataUnavailableError();
  });

  const scoreCandidates = filteredScores.map((score) => {
    const scoreCandidate: BountyScoreCandidate = {
      ...score,
      beatmap: {
        ...score.beatmap,
        max_combo: beatmapMetadata.max_combo,
      },
      validity: evaluateBountyCompletion(score, bounty, user, beatmapMetadata),
    };
    return scoreCandidate;
  });

  return scoreCandidates;
}
