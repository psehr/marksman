import { db } from "../db";
import {
  findCursorByStream,
  upsertCursor,
} from "../db/score-discovery-cursors";
import { parseDiscoveredScores } from "../integrations/osu/score-parser";
import { fetchScoresBatch } from "../integrations/osu/scores";
import { recordDiscoveredScores } from "./bounty-hunts-attempts";
import { OsuCursorExpiredError } from "./errors";

let isHealthy = false;

export async function processDiscoveredScores(payload: unknown) {
  const parsedScores = parseDiscoveredScores(payload);

  const failures = await recordDiscoveredScores(parsedScores.scores);

  return { rejectedCount: parsedScores.rejectedCount, failures };
}

async function initializeCursor(): Promise<string> {
  const { cursor_string } = await fetchScoresBatch();

  await upsertCursor(db, "osu-standard", cursor_string);

  return cursor_string;
}

export async function discoverScores() {
  try {
    let cursor = await findCursorByStream(db, "osu-standard");

    // cursor initialization
    if (!cursor) cursor = await initializeCursor();

    let batch;

    try {
      batch = await fetchScoresBatch(cursor);
    } catch (error) {
      if (!(error instanceof OsuCursorExpiredError)) throw error;

      cursor = await initializeCursor();
      batch = await fetchScoresBatch(cursor);
      console.error(
        "Outdated cursor skipped interval in score submission feed",
      );
    }

    const result = await processDiscoveredScores(batch.scores);

    if (result.rejectedCount > 0 || result.failures.length > 0) {
      throw new Error(
        `Score discovery failed: ${result.rejectedCount} rejected scores, ` +
          `${result.failures.length} persistence failures`,
        { cause: result.failures },
      );
    }

    await upsertCursor(db, "osu-standard", batch.cursor_string);

    isHealthy = true;
  } catch (error) {
    isHealthy = false;

    throw error;
  }
}

export function isDiscoveryHealthy() {
  return isHealthy;
}
