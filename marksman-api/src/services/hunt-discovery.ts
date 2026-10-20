import { parseDiscoveredScores } from "../integrations/osu/score-parser";
import { recordDiscoveredScores } from "./bounty-hunts-attempts";

export async function processDiscoveredScores(payload: unknown) {
  const parsedScores = parseDiscoveredScores(payload);

  const failures = await recordDiscoveredScores(parsedScores.scores);

  return { rejectedCount: parsedScores.rejectedCount, failures };
}
