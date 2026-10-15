import { BountyScoreCandidate, UserIdentity } from "@marksman/contracts";
import { findBountyById } from "../db/bounties";
import { BeatmapMetadataUnavailableError, BountyNotFoundError } from "./errors";
import { fetchScore } from "../integrations/osu/scores";
import { getBeatmap } from "../integrations/osu/beatmaps";
import { evaluateBountyCompletion } from "./bounty-verification";

export async function getBountyScorePreview(
  bountyId: string,
  scoreId: number,
  identity: UserIdentity,
): Promise<BountyScoreCandidate> {
  const bounty = await findBountyById(bountyId);
  if (!bounty) throw new BountyNotFoundError();

  const score = await fetchScore(scoreId);

  const beatmap = await getBeatmap(bounty.goal.beatmapId).catch(() => {
    throw new BeatmapMetadataUnavailableError();
  });

  const validity = evaluateBountyCompletion(score, bounty, identity, beatmap);

  const scorePreview: BountyScoreCandidate = {
    ...score,
    validity: validity,
  };

  return scorePreview;
}
