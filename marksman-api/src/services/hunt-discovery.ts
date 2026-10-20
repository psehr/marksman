import { db } from "../db";
import {
  findCursorByStream,
  upsertCursor,
} from "../db/score-discovery-cursors";
import { parseDiscoveredScores } from "../integrations/osu/score-parser";
import { fetchScoresBatch } from "../integrations/osu/scores";
import { recordDiscoveredScores } from "./bounty-hunts-attempts";

export async function processDiscoveredScores(payload: unknown) {
  const parsedScores = parseDiscoveredScores(payload);

  const failures = await recordDiscoveredScores(parsedScores.scores);

  return { rejectedCount: parsedScores.rejectedCount, failures };
}

export async function discoverScores() {
  let cursor = await findCursorByStream(db, "osu-standard");

  // cursor initialization
  if (!cursor) {
    const initialBatch = await fetchScoresBatch();

    await upsertCursor(db, "osu-standard", initialBatch.cursor_string);

    cursor = initialBatch.cursor_string;
  }

  const batch = await fetchScoresBatch(cursor);

  const result = await processDiscoveredScores(batch.scores);

  if (result.rejectedCount > 0 || result.failures.length > 0) {
    throw new Error(
      `Score discovery failed: ${result.rejectedCount} rejected scores, ` +
        `${result.failures.length} persistence failures`,
      { cause: result.failures },
    );
  }

  await upsertCursor(db, "osu-standard", batch.cursor_string);
}
