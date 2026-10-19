import { parseDiscoveredScores } from "../integrations/osc/scores";
import { recordDiscoveredScores } from "./bounty-hunts-attempts";

export async function processOscScores(payload: unknown) {
  const parsedScores = parseDiscoveredScores(payload);

  const failures = await recordDiscoveredScores(parsedScores.scores);

  return { rejectedCount: parsedScores.rejectedCount, failures };
}
