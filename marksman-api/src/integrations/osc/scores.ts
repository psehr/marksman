import {
  HuntAttemptScoreEvidence,
  huntAttemptScoreEvidenceSchema,
} from "@marksman/contracts";

export function parseDiscoveredScores(payload: unknown) {
  if (!Array.isArray(payload))
    throw new Error("Unexpected payload shape when parsing discovered scores");

  const parsedScores: {
    scores: HuntAttemptScoreEvidence[];
    rejectedCount: number;
  } = {
    scores: [],
    rejectedCount: 0,
  };

  for (const payloadItem of payload) {
    const scoreParse = huntAttemptScoreEvidenceSchema.safeParse(payloadItem);

    if (scoreParse.success) {
      parsedScores.scores.push(scoreParse.data);
    } else {
      parsedScores.rejectedCount++;
    }
  }

  return parsedScores;
}
