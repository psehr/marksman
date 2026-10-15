import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { BeatmapNotFoundError, OsuApiError, ScoreNotFoundError } from "../src/services/errors";

// Use local fixtures only, even if a development .env exists.
Object.assign(process.env, {
  PORT: "3001",
  DATABASE_URL:
    "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  FRONTEND_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});

const tokenUrl = "https://osu.ppy.sh/oauth/token";
const beatmapUrl = "https://osu.ppy.sh/api/v2/beatmaps/123456";
const tokenBody = {
  access_token: "fixture-token",
  token_type: "Bearer",
  expires_in: 3600,
};
const beatmapBody = {
  id: 123456,
  ar: 9, accuracy: 8, cs: 4, drain: 6,
  total_length: 120, hit_length: 110, playcount: 1000,
  checksum: "0123456789abcdef0123456789abcdef",
  version: "Hard",
  difficulty_rating: 3.5,
  mode: "osu",
  status: "ranked",
  bpm: 180,
  max_combo: 500,
  url: "https://osu.ppy.sh/beatmaps/123456",
  beatmapset: {
    title: "Fixture song",
    artist: "Fixture artist",
    creator: "Fixture mapper",
    user_id: 7,
    covers: {
      cover: "https://assets.ppy.sh/beatmaps/123/covers/cover.jpg",
      card: "https://assets.ppy.sh/beatmaps/123/covers/card.jpg",
    },
  },
};

let auth: typeof import("../src/integrations/osu/auth");
let beatmaps: typeof import("../src/integrations/osu/beatmaps");
let scores: typeof import("../src/integrations/osu/scores");
let now: number;

beforeEach(() => {
  // Reload cache owners and their consumers so every test shares one fresh
  // auth module, with isolated token and beatmap caches.
  for (const modulePath of [
    "../src/integrations/osu/auth",
    "../src/integrations/osu/beatmaps",
    "../src/integrations/osu/scores",
  ]) {
    delete require.cache[require.resolve(modulePath)];
  }
  auth = require("../src/integrations/osu/auth");
  beatmaps = require("../src/integrations/osu/beatmaps");
  scores = require("../src/integrations/osu/scores");
  now = 1_000_000;
  mock.method(Date, "now", () => now);
  mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected fetch: real network access is disabled");
  });
});

const scoreId = 987654;
const scoreUrl = `https://osu.ppy.sh/api/v2/scores/${scoreId}`;
const scoreBody = {
  id: scoreId,
  user_id: 42,
  beatmap_id: 123456,
  ruleset_id: 0,
  legacy_score_id: null,
  ended_at: "2026-09-19T12:30:00+00:00",
  accuracy: 0.985,
  mods: [
    { acronym: "DT", settings: { speed_change: 1.2, adjust_pitch: false } },
    { acronym: "HD" },
  ],
  rank: "S",
  max_combo: 498,
  statistics: { miss: 0, large_tick_miss: 0, combo_break: 0 },
  passed: true,
  beatmap: {
    version: beatmapBody.version,
    difficulty_rating: beatmapBody.difficulty_rating,
    max_combo: beatmapBody.max_combo,
  },
  beatmapset: beatmapBody.beatmapset,
};

function mockScoreResponse(makeResponse: () => Response | Promise<Response>) {
  return mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (input === tokenUrl) return Response.json(tokenBody);
      assert.equal(input, scoreUrl);
      assert.equal(init?.method ?? "GET", "GET");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), "Bearer fixture-token");
      assert.equal(headers.get("Accept"), "application/json");
      assert.equal(headers.get("x-api-version"), "20220705");
      assert.ok(init?.signal instanceof AbortSignal);
      return makeResponse();
    },
  );
}

test("score fetcher requests the modern format and preserves mod settings and zero statistics", async () => {
  const fetchMock = mockScoreResponse(() => Response.json(scoreBody));
  assert.deepEqual(await scores.fetchScore(scoreId), scoreBody);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("score fetcher accepts stable scores with sparse statistics and no mod settings", async () => {
  const body = {
    ...scoreBody,
    legacy_score_id: 123,
    ended_at: "2026-09-19T12:30:00Z",
    mods: [{ acronym: "HD" }],
    statistics: {},
  };
  mockScoreResponse(() => Response.json(body));
  assert.deepEqual(await scores.fetchScore(scoreId), body);
});

test("score fetcher accepts an absent legacy ID and leaves failed scores for the verifier", async () => {
  const { legacy_score_id, ...body } = {
    ...scoreBody,
    passed: false,
    max_combo: 0,
    accuracy: 0,
    statistics: { miss: 10, large_tick_miss: 2, combo_break: 1 },
  };
  mockScoreResponse(() => Response.json(body));
  assert.deepEqual(await scores.fetchScore(scoreId), body);
});

for (const status of [404, 429, 500]) {
  test(`score fetcher rejects HTTP ${status} before parsing the body`, async () => {
    const response = Response.json(scoreBody, { status });
    const jsonMock = mock.method(response, "json");
    mockScoreResponse(() => response);
    await assert.rejects(
      scores.fetchScore(scoreId),
      status === 404 ? ScoreNotFoundError : OsuApiError,
    );
    assert.equal(jsonMock.mock.callCount(), 0);
  });
}

for (const [name, override] of [
  ["missing beatmap ID", { beatmap_id: undefined }],
  ["named ruleset instead of numeric ID", { ruleset_id: "osu" }],
  ["accuracy expressed as a percentage", { accuracy: 98.5 }],
  ["negative miss count", { statistics: { miss: -1 } }],
  ["fractional sliderbreak count", { statistics: { large_tick_miss: 0.5 } }],
  ["missing statistics", { statistics: undefined }],
  ["invalid timestamp", { ended_at: "yesterday" }],
  ["legacy mod strings", { mods: ["HD"] }],
  ["unrecognized grade", { rank: "SS" }],
  ["missing score ID", { id: undefined }],
  ["missing claimant ID", { user_id: undefined }],
  ["negative combo", { max_combo: -1 }],
  ["missing pass status", { passed: undefined }],
] as const) {
  test(`score fetcher wraps invalid schema for ${name}`, async () => {
    mockScoreResponse(() => Response.json({ ...scoreBody, ...override }));
    await assert.rejects(scores.fetchScore(scoreId), OsuApiError);
  });
}

test("score fetcher wraps invalid JSON errors", async () => {
  mockScoreResponse(() => new Response("not JSON"));
  await assert.rejects(scores.fetchScore(scoreId), OsuApiError);
});

for (const error of [
  new TypeError("Network unavailable"),
  new DOMException("Fixture timeout", "TimeoutError"),
]) {
  test(`score fetcher wraps ${error.name} and permits retry`, async () => {
    let fail = true;
    const fetchMock = mockScoreResponse(() => {
      if (fail) throw error;
      return Response.json(scoreBody);
    });
    await assert.rejects(scores.fetchScore(scoreId), OsuApiError);
    fail = false;
    assert.deepEqual(await scores.fetchScore(scoreId), scoreBody);
    // The successful token remains cached across the failed score request.
    assert.equal(fetchMock.mock.callCount(), 3);
  });
}

test("score fetcher configures a ten-second request timeout", async () => {
  const signal = new AbortController().signal;
  const timeoutMock = mock.method(AbortSignal, "timeout", () => signal);
  mockScoreResponse(() => Response.json(scoreBody));
  await auth.getOsuAccessToken();
  timeoutMock.mock.resetCalls();
  await scores.fetchScore(scoreId);
  assert.equal(timeoutMock.mock.callCount(), 1);
  assert.deepEqual(timeoutMock.mock.calls[0].arguments, [10_000]);
});

test("score fetcher stops when obtaining a token fails", async () => {
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0]) => {
      assert.equal(input, tokenUrl);
      return Response.json({ error: "invalid_client" }, { status: 401 });
    },
  );
  await assert.rejects(scores.fetchScore(scoreId), OsuApiError);
  assert.equal(fetchMock.mock.callCount(), 1);
});

afterEach(() => mock.restoreAll());

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("token helper sends client credentials and reuses a valid token", async () => {
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      assert.equal(input, tokenUrl);
      assert.equal(init?.method, "POST");
      assert.equal(
        new Headers(init?.headers).get("Content-Type"),
        "application/x-www-form-urlencoded",
      );
      assert.ok(init?.body instanceof URLSearchParams);
      assert.deepEqual(Object.fromEntries(init.body), {
        client_id: "123",
        client_secret: "fixture-client-secret",
        grant_type: "client_credentials",
        scope: "public",
      });
      assert.ok(init.signal instanceof AbortSignal);
      return Response.json(tokenBody);
    },
  );

  assert.equal(await auth.getOsuAccessToken(), "fixture-token");
  now += 60_000;
  assert.equal(await auth.getOsuAccessToken(), "fixture-token");
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("token refresh starts at the expiration safety margin", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    Response.json({ ...tokenBody, access_token: `token-${now}` }),
  );
  const original = await auth.getOsuAccessToken();
  now += 3_540_000 - 1;
  assert.equal(await auth.getOsuAccessToken(), original);
  assert.equal(fetchMock.mock.callCount(), 1);
  now += 1;
  assert.notEqual(await auth.getOsuAccessToken(), original);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("concurrent callers share one token request, including response parsing", async () => {
  const body = deferred<typeof tokenBody>();
  const response = Response.json(tokenBody);
  const jsonMock = mock.method(response, "json", () => body.promise);
  const fetchMock = mock.method(globalThis, "fetch", async () => response);

  const first = auth.getOsuAccessToken();
  await Promise.resolve();
  const second = auth.getOsuAccessToken();
  const third = auth.getOsuAccessToken();
  body.resolve(tokenBody);

  assert.deepEqual(
    await Promise.all([first, second, third]),
    Array(3).fill("fixture-token"),
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(jsonMock.mock.callCount(), 1);
});

test("a shared failed token request rejects all callers and allows retry", async () => {
  const pending = deferred<Response>();
  const fetchMock = mock.method(globalThis, "fetch", () => pending.promise);
  const failures = Promise.all([
    assert.rejects(
      auth.getOsuAccessToken(),
      /Unable to get an osu! access token/,
    ),
    assert.rejects(
      auth.getOsuAccessToken(),
      /Unable to get an osu! access token/,
    ),
  ]);
  pending.reject(new Error("Network unavailable"));
  await failures;
  assert.equal(fetchMock.mock.callCount(), 1);

  fetchMock.mock.mockImplementation(async () => Response.json(tokenBody));
  assert.equal(await auth.getOsuAccessToken(), "fixture-token");
  assert.equal(fetchMock.mock.callCount(), 2);
});

for (const [name, response] of [
  // A valid-looking body ensures the HTTP status check is actually exercised.
  ["HTTP failure", () => Response.json(tokenBody, { status: 500 })],
  ["invalid token data", () => Response.json({ ...tokenBody, expires_in: 0 })],
  ["invalid JSON", () => new Response("not JSON")],
] as const) {
  test(`token helper rejects ${name} without caching the failure`, async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => response());
    await assert.rejects(
      auth.getOsuAccessToken(),
      /Unable to get an osu! access token/,
    );
    fetchMock.mock.mockImplementation(async () => Response.json(tokenBody));
    assert.equal(await auth.getOsuAccessToken(), "fixture-token");
    assert.equal(fetchMock.mock.callCount(), 2);
  });
}

function mockBeatmapResponse(makeResponse: () => Response | Promise<Response>) {
  return mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (input === tokenUrl) return Response.json(tokenBody);
      assert.equal(input, beatmapUrl);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), "Bearer fixture-token");
      assert.equal(headers.get("Accept"), "application/json");
      assert.ok(init?.signal instanceof AbortSignal);
      return makeResponse();
    },
  );
}

test("beatmap fetcher authenticates and preserves nested cover metadata", async () => {
  mockBeatmapResponse(() => Response.json(beatmapBody));
  assert.deepEqual(await beatmaps.getBeatmap(123456), beatmapBody);
});

test("beatmap fetcher accepts null BPM and an unavailable beatmapset", async () => {
  const body = { ...beatmapBody, bpm: null, beatmapset: null };
  mockBeatmapResponse(() => Response.json(body));
  assert.deepEqual(await beatmaps.getBeatmap(123456), body);
});

test("beatmap fetcher preserves the dedicated not-found error", async () => {
  mockBeatmapResponse(() => new Response(null, { status: 404 }));
  await assert.rejects(beatmaps.getBeatmap(123456), BeatmapNotFoundError);
});

for (const [name, response] of [
  ["HTTP failure", () => Response.json(beatmapBody, { status: 500 })],
  [
    "invalid metadata",
    () => Response.json({ ...beatmapBody, mode: "invalid" }),
  ],
  [
    "missing nested covers",
    () =>
      Response.json({
        ...beatmapBody,
        beatmapset: { title: "Song", artist: "Artist", creator: "Mapper" },
      }),
  ],
  ["invalid JSON", () => new Response("not JSON")],
  [
    "network failure",
    () => {
      throw new Error("Network unavailable");
    },
  ],
] as const) {
  test(`beatmap fetcher rejects ${name}`, async () => {
    mockBeatmapResponse(response);
    await assert.rejects(
      beatmaps.getBeatmap(123456),
      OsuApiError,
    );
  });
}

test("beatmap fetcher stops when obtaining a token fails", async () => {
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0]) => {
      assert.equal(input, tokenUrl);
      return Response.json({ error: "invalid_client" }, { status: 401 });
    },
  );
  await assert.rejects(
    beatmaps.getBeatmap(123456),
    OsuApiError,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});

const metadataTtl = 10 * 60 * 1000;

function metadataFor(id: number) {
  return { ...beatmapBody, id, url: `https://osu.ppy.sh/beatmaps/${id}` };
}

function mockBeatmapRequests(
  respond: (id: number) => Response | Promise<Response> = (id) =>
    Response.json(metadataFor(id)),
) {
  const counts = new Map<number, number>();
  mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0]) => {
      if (input === tokenUrl) return Response.json(tokenBody);
      const match = /^https:\/\/osu\.ppy\.sh\/api\/v2\/beatmaps\/(\d+)$/.exec(
        String(input),
      );
      assert.ok(match, `Unexpected fetch: ${String(input)}`);
      const id = Number(match[1]);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      return respond(id);
    },
  );
  return counts;
}

test("beatmap cache reuses metadata until the exact expiration boundary", async () => {
  let version = "Original";
  const counts = mockBeatmapRequests((id) =>
    Response.json({ ...metadataFor(id), version }),
  );
  const original = await beatmaps.getBeatmap(1);
  version = "Updated";
  now += metadataTtl - 1;
  assert.deepEqual(await beatmaps.getBeatmap(1), original);
  assert.equal(counts.get(1), 1);

  now += 1;
  const refreshed = await beatmaps.getBeatmap(1);
  assert.equal(refreshed.version, "Updated");
  assert.equal(counts.get(1), 2);
  assert.deepEqual(await beatmaps.getBeatmap(1), refreshed);
  assert.equal(counts.get(1), 2);
});

test("concurrent beatmap callers share a request through response parsing", async () => {
  const body = deferred<ReturnType<typeof metadataFor>>();
  const parsingStarted = deferred<void>();
  const response = Response.json(metadataFor(1));
  const jsonMock = mock.method(response, "json", () => {
    parsingStarted.resolve();
    return body.promise;
  });
  const counts = mockBeatmapRequests(() => response);
  const first = beatmaps.getBeatmap(1);
  await parsingStarted.promise;
  const second = beatmaps.getBeatmap(1);
  const third = beatmaps.getBeatmap(1);
  body.resolve(metadataFor(1));

  assert.deepEqual(
    await Promise.all([first, second, third]),
    Array(3).fill(metadataFor(1)),
  );
  assert.equal(counts.get(1), 1);
  assert.equal(jsonMock.mock.callCount(), 1);
});

test("different beatmap IDs fetch independently while another request is pending", async () => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  const counts = mockBeatmapRequests((id) => {
    if (id === 1) {
      started.resolve();
      return pending.promise;
    }
    return Response.json(metadataFor(id));
  });
  const first = beatmaps.getBeatmap(1);
  await started.promise;
  // Race against a local sentinel so accidental cross-ID sharing fails without hanging.
  const second = beatmaps.getBeatmap(2);
  const result = await Promise.race([
    second,
    new Promise<null>((resolve) => setImmediate(() => resolve(null))),
  ]);
  pending.resolve(Response.json(metadataFor(1)));
  const results = await Promise.all([first, second]);
  assert.deepEqual(result, metadataFor(2));
  assert.deepEqual(results, [metadataFor(1), metadataFor(2)]);
  assert.equal(counts.get(1), 1);
  assert.equal(counts.get(2), 1);
});

test("a failed shared beatmap request rejects all callers and permits retry", async () => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  let fail = true;
  const counts = mockBeatmapRequests((id) => {
    if (fail) {
      started.resolve();
      return pending.promise;
    }
    return Response.json(metadataFor(id));
  });
  const first = beatmaps.getBeatmap(1);
  await started.promise;
  const failures = Promise.all([
    assert.rejects(first, OsuApiError),
    assert.rejects(beatmaps.getBeatmap(1), OsuApiError),
  ]);
  pending.reject(new Error("Network unavailable"));
  await failures;
  assert.equal(counts.get(1), 1);

  fail = false;
  assert.deepEqual(await beatmaps.getBeatmap(1), metadataFor(1));
  assert.deepEqual(await beatmaps.getBeatmap(1), metadataFor(1));
  assert.equal(counts.get(1), 2);
});

test("the 501st beatmap evicts the earliest expiry even when it was inserted later", async () => {
  const pending = deferred<Response>();
  const started = deferred<void>();
  let delay = true;
  const counts = mockBeatmapRequests((id) => {
    if (id === 1 && delay) {
      started.resolve();
      return pending.promise;
    }
    return Response.json(metadataFor(id));
  });
  const earliest = beatmaps.getBeatmap(1);
  await started.promise;
  now += 1_000;
  for (let id = 2; id <= 500; id++) await beatmaps.getBeatmap(id);
  delay = false;
  pending.resolve(Response.json(metadataFor(1)));
  await earliest;
  await beatmaps.getBeatmap(501);

  for (let id = 2; id <= 501; id++) {
    assert.deepEqual(await beatmaps.getBeatmap(id), metadataFor(id));
    assert.equal(counts.get(id), 1, `Beatmap ${id} should remain cached`);
  }
  await beatmaps.getBeatmap(1);
  assert.equal(counts.get(1), 2);
});

test("capacity eviction still removes one entry when all expirations are equal", async () => {
  const counts = mockBeatmapRequests();
  for (let id = 1; id <= 501; id++) await beatmaps.getBeatmap(id);
  // With equal expirations the first encountered candidate is evicted.
  for (let id = 2; id <= 501; id++) {
    await beatmaps.getBeatmap(id);
    assert.equal(counts.get(id), 1);
  }
  await beatmaps.getBeatmap(1);
  assert.equal(counts.get(1), 2);
});

test("expired entries are removed before capacity eviction of valid metadata", async () => {
  const counts = mockBeatmapRequests();
  await beatmaps.getBeatmap(1);
  await beatmaps.getBeatmap(2);
  now += 1_000;
  for (let id = 3; id <= 500; id++) await beatmaps.getBeatmap(id);
  now += metadataTtl - 1_000;
  // Both old entries expire at this boundary, making room for two new maps.
  await beatmaps.getBeatmap(501);
  await beatmaps.getBeatmap(502);
  for (let id = 3; id <= 502; id++) {
    await beatmaps.getBeatmap(id);
    assert.equal(counts.get(id), 1, `Valid beatmap ${id} should remain cached`);
  }
  await beatmaps.getBeatmap(1);
  await beatmaps.getBeatmap(2);
  assert.equal(counts.get(1), 2);
  assert.equal(counts.get(2), 2);
});
