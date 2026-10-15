import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import express from "express";
import { osuBeatmapMetadataSchema } from "@marksman/contracts";
import { metadata } from "./fixtures/completion";

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

const httpFetch = globalThis.fetch;
let server: Server;
let baseUrl: string;
let mapId = 900000;
let calls: string[];
let reply: () => Response | Promise<Response>;

before(async () => {
  // Exercise the real router and integration without database/session middleware.
  const { beatmapsRouter } =
    require("../src/routes/beatmaps") as typeof import("../src/routes/beatmaps");
  const app = express();
  app.use("/beatmaps", beatmapsRouter);
  mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      if (url === "https://osu.ppy.sh/oauth/token") {
        return Response.json({
          access_token: "fixture-token",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      if (url === `https://osu.ppy.sh/api/v2/beatmaps/${mapId}`) return reply();
      throw new Error(`Unexpected fetch: ${url}; live requests are disabled`);
    },
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  // Avoid previously cached metadata masking a failure case.
  mapId++;
  calls = [];
  reply = () => Response.json(metadata);
});

after(async () => {
  try {
    if (server)
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
  } finally {
    mock.restoreAll();
  }
});

function request(id: string | number = mapId) {
  return httpFetch(`${baseUrl}/beatmaps/${encodeURIComponent(id)}`);
}

for (const id of ["abc", "0", "-1", "1.5", "Infinity", "9007199254740992"]) {
  test(`beatmap route rejects invalid ID ${id} without upstream requests`, async () => {
    const response = await request(id);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      code: "MALFORMED_BEATMAP_ID",
      error: "Malformed beatmap ID",
    });
    assert.deepEqual(calls, []);
  });
}

test("beatmap route returns validated metadata publicly and reuses cached success", async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(
      osuBeatmapMetadataSchema.parse(await response.json()),
      metadata,
    );
  }
  assert.equal(
    calls.filter((url) => url.includes("/api/v2/beatmaps/")).length,
    1,
  );
});

const failures: [
  string,
  () => Response | Promise<Response>,
  number,
  string,
  string,
][] = [
  [
    "missing beatmap",
    () => new Response(null, { status: 404 }),
    404,
    "BEATMAP_NOT_FOUND",
    "Beatmap was not found",
  ],
  [
    "upstream server error",
    () => new Response(null, { status: 500 }),
    502,
    "UNAVAILABLE_METADATA",
    "Unable to retrieve beatmap metadata. Please try again.",
  ],
  [
    "upstream rate limit",
    () => new Response(null, { status: 429 }),
    502,
    "UNAVAILABLE_METADATA",
    "Unable to retrieve beatmap metadata. Please try again.",
  ],
  [
    "network failure",
    () => {
      throw new TypeError("fixture network failure");
    },
    502,
    "UNAVAILABLE_METADATA",
    "Unable to retrieve beatmap metadata. Please try again.",
  ],
  [
    "timeout",
    () => {
      throw new DOMException("fixture timeout", "TimeoutError");
    },
    502,
    "UNAVAILABLE_METADATA",
    "Unable to retrieve beatmap metadata. Please try again.",
  ],
  [
    "invalid JSON",
    () => new Response("not JSON"),
    502,
    "UNAVAILABLE_METADATA",
    "Unable to retrieve beatmap metadata. Please try again.",
  ],
  [
    "invalid metadata",
    () => Response.json({ version: "Hard" }),
    502,
    "UNAVAILABLE_METADATA",
    "Unable to retrieve beatmap metadata. Please try again.",
  ],
];

for (const [label, failure, status, code, error] of failures) {
  test(`beatmap route maps ${label} and allows a successful retry`, async () => {
    reply = failure;
    const failed = await request();
    assert.equal(failed.status, status);
    assert.deepEqual(await failed.json(), { code, error });
    reply = () => Response.json(metadata);
    const retried = await request();
    assert.equal(retried.status, 200);
    assert.deepEqual(await retried.json(), metadata);
    assert.equal(
      calls.filter((url) => url.includes("/api/v2/beatmaps/")).length,
      2,
    );
  });
}
