import { ScoreResponse, scoreResponseSchema } from "@marksman/contracts";
import { getOsuAccessToken } from "./auth";
import { OsuApiError, ScoreNotFoundError } from "../../services/errors";
import z from "zod";

export async function fetchScore(scoreId: number): Promise<ScoreResponse> {
  const token = await getOsuAccessToken().catch(() => {
    throw new OsuApiError();
  });

  const response = await fetch(`https://osu.ppy.sh/api/v2/scores/${scoreId}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "x-api-version": "20220705",
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new OsuApiError();
  });

  if (response.status === 404) {
    throw new ScoreNotFoundError();
  } else if (!response.ok) {
    throw new OsuApiError();
  }

  const score = scoreResponseSchema.safeParse(
    await response.json().catch(() => {
      throw new OsuApiError();
    }),
  );

  if (!score.success) {
    throw new OsuApiError();
  }

  return score.data;
}

export async function fetchRecentScores(
  userId: number,
): Promise<ScoreResponse[]> {
  const token = await getOsuAccessToken().catch(() => {
    throw new OsuApiError();
  });

  const response = await fetch(
    `https://osu.ppy.sh/api/v2/users/${userId}/scores/recent?mode=osu&include_fails=0&legacy_only=0`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "x-api-version": "20220705",
      },
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => {
    throw new OsuApiError();
  });

  if (!response.ok) throw new OsuApiError();

  const scores = scoreResponseSchema.array().safeParse(
    await response.json().catch(() => {
      throw new OsuApiError();
    }),
  );

  if (!scores.success) throw new OsuApiError();

  return scores.data;
}

const scoresBatchResponseSchema = z.object({
  scores: z.array(z.unknown()),
  cursor_string: z.string().min(1),
});

export async function fetchScoresBatch(cursor?: string) {
  const token = await getOsuAccessToken().catch(() => {
    throw new OsuApiError();
  });

  const url = new URL("https://osu.ppy.sh/api/v2/scores");
  url.searchParams.append("ruleset", "osu");
  if (cursor) url.searchParams.append("cursor_string", cursor);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "x-api-version": "20220705",
    },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new OsuApiError();
  });

  if (!response.ok) throw new OsuApiError();

  const parsed = scoresBatchResponseSchema.safeParse(
    await response.json().catch(() => {
      throw new OsuApiError();
    }),
  );

  if (!parsed.success) throw new OsuApiError();

  return parsed.data;
}
