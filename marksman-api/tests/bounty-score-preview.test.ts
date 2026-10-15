import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { bountyScoreCandidateSchema, type ScoreResponse } from "@marksman/contracts";
import { bounties, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

// Configure the isolated database before importing the application/pool.
Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_score_preview_tests&options=-c%20statement_timeout%3D10000",
  FRONTEND_URL: "http://localhost:3000/", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { app } = require("../src/app") as typeof import("../src/app");
const { sessionStore } = require("../src/db/session-store") as typeof import("../src/db/session-store");
const testDatabase = createTestDatabase(db, true);
const httpFetch = globalThis.fetch;
let server: Server | undefined;
let baseUrl: string;
let alice: typeof users.$inferSelect;
let bob: typeof users.$inferSelect;
let creator: typeof users.$inferSelect;
let beatmapId = 900000;
let upstreamCalls: string[] = [];
let score: ScoreResponse;
let scoreReply: () => Response;
let metadataReply: () => Response;
let initialRows: Awaited<ReturnType<typeof snapshot>> | undefined;
let scoreRequest: { url: URL; options?: RequestInit } | undefined;

before(async () => {
  await testDatabase.prepare();
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    upstreamCalls.push(url);
    if (url === "https://osu.ppy.sh/oauth/token") {
      return Response.json({ access_token: "fixture-token", expires_in: 3600, token_type: "Bearer" });
    }
    if (url === `https://osu.ppy.sh/api/v2/scores/${score.id}`) {
      scoreRequest = { url: new URL(url), options };
      return scoreReply();
    }
    const match = /^https:\/\/osu\.ppy\.sh\/api\/v2\/beatmaps\/(\d+)$/.exec(url);
    if (match && Number(match[1]) === beatmapId) return metadataReply();
    throw new Error(`Unexpected fetch: ${url}; live requests are disabled`);
  });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await testDatabase.clear();
  upstreamCalls = [];
  initialRows = undefined;
  beatmapId++;
  score = { ...qualifyingScore(), beatmap_id: beatmapId };
  scoreReply = () => Response.json(score);
  metadataReply = () => Response.json(metadata);
  scoreRequest = undefined;
  [alice, bob, creator] = await db.insert(users).values([
    { osuUserId: 42, username: "alice" },
    { osuUserId: 43, username: "bob" },
    { osuUserId: 7, username: "creator" },
  ]).returning();
});

after(async () => {
  try {
    if (server) await new Promise<void>((resolve, reject) => {
      server!.close(error => error ? reject(error) : resolve());
      server!.closeAllConnections();
    });
    sessionStore.close();
    await testDatabase.clearIfMigrated();
  } finally {
    mock.restoreAll();
    await db.$client.end();
  }
});

async function cookieFor(userId: string) {
  const sid = randomUUID();
  const expire = new Date(Date.now() + 60_000);
  await db.insert(sessions).values({ sid, expire, sess: {
    cookie: { originalMaxAge: 60_000, expires: expire.toISOString(), httpOnly: true, path: "/", sameSite: "lax" },
    userId,
  } });
  const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(sid).digest("base64").replace(/=+$/, "");
  return `marksman.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}

async function seedBounty(overrides: Partial<typeof bounties.$inferInsert> = {}) {
  const [row] = await db.insert(bounties).values({
    status: "open", rewardBp: 30, creatorOsuUserId: creator.osuUserId,
    createdAt: new Date(qualifyingBounty().createdAt),
    goal: { ...qualifyingBounty().goal, beatmapId }, ...overrides,
  }).returning();
  return row;
}

async function request(id: string, userId = alice.id, scoreId = String(score.id), query = "") {
  initialRows ??= await snapshot();
  return httpFetch(`${baseUrl}/bounties/${id}/scores/${encodeURIComponent(scoreId)}/preview${query}`, {
    headers: userId ? { Cookie: await cookieFor(userId) } : {},
  });
}

async function readCandidate(response: Response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  return bountyScoreCandidateSchema.parse(await response.json());
}

async function assertError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  const body = await response.json();
  assert.equal(body.code, code);
  assert.equal(typeof body.error, "string");
  assert.ok(body.error.length > 0);
}

function metadataCalls() {
  return upstreamCalls.filter(url => url.includes("/api/v2/beatmaps/"));
}

async function snapshot() {
  return {
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    users: await db.select().from(users).orderBy(users.id),
  };
}

afterEach(async () => {
  if (initialRows) assert.deepEqual(await snapshot(), initialRows);
});

for (const [label, id, signedIn, status, code] of [
  ["signed out", qualifyingBounty().id, false, 401, "NOT_LOGGED_IN"],
  ["malformed bounty ID", "invalid", true, 400, "MALFORMED_BOUNTY_ID"],
  ["missing bounty", qualifyingBounty().id, true, 404, "BOUNTY_NOT_FOUND"],
] as const) test(`preview rejects ${label} before upstream requests`, async () => {
  await assertError(await request(id, signedIn ? alice.id : ""), status, code);
  assert.deepEqual(upstreamCalls, []);
});

for (const id of ["abc", "0", "-1", "1.5", "Infinity", "9007199254740992"]) {
  test(`preview rejects malformed score ID ${id} before upstream requests`, async () => {
    const bounty = await seedBounty();
    await assertError(await request(bounty.id, alice.id, id), 400, "MALFORMED_SCORE_ID");
    assert.deepEqual(upstreamCalls, []);
  });
}

test("passing preview preserves the score and uses modern single-score lookup without payout", async () => {
  const bounty = await seedBounty();
  const { validity, ...display } = await readCandidate(await request(bounty.id));
  assert.deepEqual(display, score);
  assert.deepEqual(validity, {
    playerIsClaimant: true, bountyIsClaimable: true, playerIsNotOwner: true,
    beatmapIsCorrect: true, rulesetIsCorrect: true, scoreIsSetAfterCreation: true,
    scoreIsPassed: true, modsAreCorrect: true, fcIsSatisfied: true,
  });
  assert.equal(scoreRequest!.url.pathname, `/api/v2/scores/${score.id}`);
  const headers = new Headers(scoreRequest!.options?.headers);
  assert.equal(headers.get("x-api-version"), "20220705");
  assert.equal(headers.get("Authorization"), "Bearer fixture-token");
  assert.ok(scoreRequest!.options?.signal instanceof AbortSignal);
  assert.deepEqual(metadataCalls(), [`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}`]);
});

test("preview uses session identity and ignores supplied user identity", async () => {
  const bounty = await seedBounty();
  const query = `?userId=${alice.id}&osuUserId=${alice.osuUserId}`;
  const candidate = await readCandidate(await request(bounty.id, bob.id, String(score.id), query));
  assert.equal(candidate.validity.playerIsClaimant, false);
  assert.equal((await readCandidate(await request(bounty.id, alice.id))).validity.playerIsClaimant, true);
});

test("wrong-map preview retains score display metadata and evaluates with the bounty map maximum", async () => {
  const bounty = await seedBounty();
  score.beatmap_id = beatmapId + 1;
  score.legacy_score_id = 123;
  score.max_combo = 990;
  score.beatmap = { version: "Other difficulty", difficulty_rating: 7, max_combo: 2000 };
  score.beatmapset = {
    title: "Other song", artist: "Other artist", creator: "Other mapper", user_id: 8,
    covers: { cover: "https://assets.ppy.sh/beatmaps/99/covers/cover.jpg",
      card: "https://assets.ppy.sh/beatmaps/99/covers/card.jpg" },
  };
  const { validity, ...display } = await readCandidate(await request(bounty.id));
  assert.deepEqual(display, score);
  assert.equal(validity.beatmapIsCorrect, false);
  // 990/1000 satisfies the bounty threshold; 990/2000 would fail.
  assert.equal(validity.fcIsSatisfied, true);
  assert.deepEqual(metadataCalls(), [`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}`]);
});

test("ineligible score returns all applicable failure reasons with HTTP 200", async () => {
  const bounty = await seedBounty({ goal: { ...qualifyingBounty().goal, beatmapId,
    minimumAccuracy: 99, modRequirement: { rule: "includes", mods: ["HD"] } } });
  score = { ...score, user_id: bob.osuUserId, ruleset_id: 1, passed: false,
    ended_at: qualifyingBounty().createdAt, accuracy: 0.8, statistics: { miss: 1 } };
  const { validity } = await readCandidate(await request(bounty.id));
  assert.deepEqual(validity, {
    playerIsClaimant: false, bountyIsClaimable: true, playerIsNotOwner: true,
    beatmapIsCorrect: true, rulesetIsCorrect: false, scoreIsSetAfterCreation: false,
    scoreIsPassed: false, modsAreCorrect: false, scoreAccuracyIsSatisfied: false,
    fcIsSatisfied: false,
  });
});

test("closed and owned bounties still return eligibility previews", async () => {
  const bounty = await seedBounty({ status: "completed", creatorOsuUserId: alice.osuUserId });
  const { validity } = await readCandidate(await request(bounty.id));
  assert.equal(validity.bountyIsClaimable, false);
  assert.equal(validity.playerIsNotOwner, false);
});

test("minimum-grade preview keeps explicit zero accuracy and omits FC", async () => {
  const bounty = await seedBounty({ goal: { type: "minimum_grade", beatmapId, beatmapChecksum: null,
    minimumGradeRequirement: "S", minimumAccuracy: 0, modRequirement: { rule: "any" } } });
  score.rank = "A";
  score.accuracy = 0;
  delete score.beatmap.max_combo;
  const candidate = await readCandidate(await request(bounty.id));
  assert.equal(candidate.validity.gradeIsSatisfied, false);
  assert.equal(candidate.validity.scoreAccuracyIsSatisfied, true);
  assert.equal(candidate.validity.fcIsSatisfied, undefined);
  assert.equal(candidate.beatmap.max_combo, undefined);
});

const scoreFailures: [string, () => Response, number, string][] = [
  ["missing score", () => new Response(null, { status: 404 }), 404, "SCORE_NOT_FOUND"],
  ["rate limit", () => new Response(null, { status: 429 }), 502, "OSU_API_ERROR"],
  ["server failure", () => new Response(null, { status: 500 }), 502, "OSU_API_ERROR"],
  ["network failure", () => { throw new TypeError("fixture network failure"); }, 502, "OSU_API_ERROR"],
  ["timeout", () => { throw new DOMException("fixture timeout", "TimeoutError"); }, 502, "OSU_API_ERROR"],
  ["invalid JSON", () => new Response("not JSON"), 502, "OSU_API_ERROR"],
  ["invalid score", () => Response.json({ id: 123 }), 502, "OSU_API_ERROR"],
  ["missing beatmapset", () => { const { beatmapset, ...body } = score; return Response.json(body); }, 502, "OSU_API_ERROR"],
];
for (const [label, failure, status, code] of scoreFailures) test(`preview maps ${label} and allows same-ID retry`, async () => {
  const bounty = await seedBounty();
  scoreReply = failure;
  await assertError(await request(bounty.id), status, code);
  assert.deepEqual(metadataCalls(), []);
  scoreReply = () => Response.json(score);
  assert.equal((await readCandidate(await request(bounty.id))).id, score.id);
});

for (const [label, failure] of [
  ["missing map", () => new Response(null, { status: 404 })],
  ["server failure", () => new Response(null, { status: 500 })],
  ["network failure", () => { throw new TypeError("fixture network failure"); }],
  ["timeout", () => { throw new DOMException("fixture timeout", "TimeoutError"); }],
  ["invalid combo metadata", () => Response.json({ ...metadata, max_combo: 0 })],
] as [string, () => Response][]) test(`preview maps metadata ${label} and allows retry`, async () => {
  const bounty = await seedBounty();
  score.legacy_score_id = 123;
  metadataReply = failure;
  await assertError(await request(bounty.id), 502, "UNAVAILABLE_BEATMAP_METADATA");
  metadataReply = () => Response.json(metadata);
  assert.equal((await readCandidate(await request(bounty.id))).validity.fcIsSatisfied, true);
});
