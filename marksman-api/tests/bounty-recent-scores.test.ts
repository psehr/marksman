import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { bountyScoreCandidateSchema, type ScoreResponse } from "@marksman/contracts";
import { bounties, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

// Configure the isolated database before importing the application/pool.
Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_recent_score_tests&options=-c%20statement_timeout%3D10000",
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
let beatmapId = 800000;
let upstreamCalls: string[] = [];
let scores: ScoreResponse[];
let scoreReply: () => Response;
let metadataReply: () => Response;
let scoreRequest: { url: URL; options?: RequestInit } | undefined;

before(async () => {
  await testDatabase.prepare();
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    upstreamCalls.push(url);
    if (url === "https://osu.ppy.sh/oauth/token") {
      return Response.json({ access_token: "fixture-token", expires_in: 3600, token_type: "Bearer" });
    }
    if (/^https:\/\/osu\.ppy\.sh\/api\/v2\/users\/\d+\/scores\/recent\?/.test(url)) {
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
  beatmapId++;
  scores = [{ ...qualifyingScore(), beatmap_id: beatmapId,
    beatmap: { version: "Hard", difficulty_rating: 3.5 }, beatmapset: null }];
  scoreReply = () => Response.json(scores);
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

async function request(id: string, userId: string | undefined = alice.id, query = "") {
  return httpFetch(`${baseUrl}/bounties/${id}/recent-scores${query}`, {
    headers: userId ? { Cookie: await cookieFor(userId) } : {},
  });
}

async function readCandidates(response: Response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  return bountyScoreCandidateSchema.array().parse(await response.json());
}

function metadataCalls() {
  return upstreamCalls.filter(url => url.includes("/api/v2/beatmaps/"));
}

for (const [label, id, signedIn, status, code] of [
  ["signed out", qualifyingBounty().id, false, 401, "NOT_LOGGED_IN"],
  ["malformed ID", "invalid", true, 400, "MALFORMED_BOUNTY_ID"],
  ["missing bounty", qualifyingBounty().id, true, 404, "BOUNTY_NOT_FOUND"],
] as const) test(`recent scores rejects ${label} before upstream requests`, async () => {
  const response = await request(id, signedIn ? alice.id : "");
  assert.equal(response.status, status);
  assert.equal((await response.json()).code, code);
  assert.deepEqual(upstreamCalls, []);
});

test("uses session osu! identity, modern request options, and preserves score display fields", async () => {
  const bounty = await seedBounty();
  const results = await readCandidates(await request(bounty.id, alice.id, `?userId=${bob.id}&osuUserId=${bob.osuUserId}`));
  assert.equal(results.length, 1);
  const { validity, ...score } = results[0];
  assert.deepEqual(score, {
    ...scores[0],
    beatmap: { ...scores[0].beatmap, max_combo: metadata.max_combo },
  });
  assert.equal(validity.playerIsClaimant, true);
  assert.equal(scoreRequest!.url.pathname, `/api/v2/users/${alice.osuUserId}/scores/recent`);
  assert.deepEqual(Object.fromEntries(scoreRequest!.url.searchParams), { mode: "osu", include_fails: "0", legacy_only: "0" });
  const headers = new Headers(scoreRequest!.options?.headers);
  assert.equal(headers.get("x-api-version"), "20220705");
  assert.equal(headers.get("Authorization"), "Bearer fixture-token");
  assert.ok(scoreRequest!.options?.signal instanceof AbortSignal);
  scores[0].user_id = bob.osuUserId;
  const bobResults = await readCandidates(await request(bounty.id, bob.id));
  assert.equal(scoreRequest!.url.pathname, `/api/v2/users/${bob.osuUserId}/scores/recent`);
  assert.equal(bobResults[0].validity.playerIsClaimant, true);
});

test("filters difficulty and strictly compares instants across offsets and millisecond boundaries", async () => {
  const bounty = await seedBounty();
  scores = [
    { ...scores[0], id: 1, ended_at: "2026-09-21T14:00:00+02:00" },
    { ...scores[0], id: 2, ended_at: "2026-09-21T11:59:59.999Z" },
    { ...scores[0], id: 3, ended_at: "2026-09-21T14:00:00.001+02:00" },
    { ...scores[0], id: 4, ended_at: "2026-09-21T08:01:00-04:00" },
    { ...scores[0], id: 5, beatmap_id: beatmapId + 1 },
  ];
  const candidates = await readCandidates(await request(bounty.id));
  assert.deepEqual(candidates.map(score => score.id), [3, 4]);
  assert.ok(candidates.every(score => score.validity.scoreIsSetAfterCreation));
  assert.equal(metadataCalls().length, 1);
});

for (const empty of [true, false]) test(`skips metadata for ${empty ? "empty" : "fully filtered"} recent scores`, async () => {
  const bounty = await seedBounty();
  scores = empty ? [] : [{ ...scores[0], beatmap_id: beatmapId + 1 }, { ...scores[0], ended_at: bounty.createdAt.toISOString() }];
  metadataReply = () => { throw new Error("Metadata must not be requested"); };
  assert.deepEqual(await readCandidates(await request(bounty.id)), []);
  assert.deepEqual(metadataCalls(), []);
});

test("retains failing candidates with simultaneous reasons, evaluates once-fetched metadata, and never pays out", async () => {
  const bounty = await seedBounty({ goal: { ...qualifyingBounty().goal, beatmapId, minimumAccuracy: 99, modRequirement: { rule: "includes", mods: ["HD"] } } });
  scores = [
    { ...scores[0], mods: [{ acronym: "HD" }], legacy_score_id: 123 },
    { ...scores[0], id: 2, accuracy: 0.9, statistics: { miss: 1 } },
  ];
  const beforeBounties = await db.select().from(bounties);
  const beforeUsers = await db.select().from(users);
  const candidates = await readCandidates(await request(bounty.id));
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0].validity, {
    playerIsClaimant: true, bountyIsClaimable: true, playerIsNotOwner: true,
    beatmapIsCorrect: true, rulesetIsCorrect: true, scoreIsSetAfterCreation: true,
    scoreIsPassed: true, scoreAccuracyIsSatisfied: true, modsAreCorrect: true, fcIsSatisfied: true,
  });
  assert.equal(candidates[1].validity.scoreAccuracyIsSatisfied, false);
  assert.equal(candidates[1].validity.modsAreCorrect, false);
  assert.equal(candidates[1].validity.fcIsSatisfied, false);
  assert.equal(metadataCalls().length, 1);
  assert.deepEqual(await db.select().from(bounties), beforeBounties);
  assert.deepEqual(await db.select().from(users), beforeUsers);
});

test("minimum-grade previews include explicit zero accuracy and omit inapplicable FC", async () => {
  const bounty = await seedBounty({ goal: { type: "minimum_grade", beatmapId, beatmapChecksum: null, minimumGradeRequirement: "S", minimumAccuracy: 0, modRequirement: { rule: "any" } } });
  scores[0].rank = "A";
  scores[0].accuracy = 0;
  const [candidate] = await readCandidates(await request(bounty.id));
  assert.equal(candidate.validity.gradeIsSatisfied, false);
  assert.equal(candidate.validity.scoreAccuracyIsSatisfied, true);
  assert.equal(candidate.validity.fcIsSatisfied, undefined);
});

test("closed and owned bounty previews expose eligibility failures without hiding candidates", async () => {
  const bounty = await seedBounty({ status: "completed", creatorOsuUserId: alice.osuUserId });
  const [candidate] = await readCandidates(await request(bounty.id));
  assert.equal(candidate.validity.bountyIsClaimable, false);
  assert.equal(candidate.validity.playerIsNotOwner, false);
});

const scoreFailures: [string, () => Response][] = [
  ["404", () => new Response(null, { status: 404 })],
  ["rate limit", () => new Response(null, { status: 429 })],
  ["server failure", () => new Response(null, { status: 500 })],
  ["network failure", () => { throw new TypeError("fixture network failure"); }],
  ["timeout", () => { throw new DOMException("fixture timeout", "TimeoutError"); }],
  ["invalid JSON", () => new Response("not JSON")],
  ["non-array response", () => Response.json({})],
  ["invalid score", () => Response.json([{ id: 123 }])],
  ["missing beatmapset", () => Response.json(scores.map(({ beatmapset, ...score }) => score))],
];
for (const [label, failure] of scoreFailures) test(`recent-score ${label} maps to 502 and can be retried`, async () => {
  const bounty = await seedBounty();
  scoreReply = failure;
  const response = await request(bounty.id);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "OSU_API_ERROR");
  assert.deepEqual(metadataCalls(), []);
  scoreReply = () => Response.json(scores);
  assert.equal((await readCandidates(await request(bounty.id))).length, 1);
});

test("metadata lookup failure maps to unavailable metadata and allows retry", async () => {
  const bounty = await seedBounty();
  metadataReply = () => new Response(null, { status: 500 });
  const response = await request(bounty.id);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "UNAVAILABLE_BEATMAP_METADATA");
  metadataReply = () => Response.json(metadata);
  assert.equal((await readCandidates(await request(bounty.id))).length, 1);
});

test("invalid upstream metadata is rejected before candidate evaluation", async () => {
  const bounty = await seedBounty();
  scores[0].legacy_score_id = 123;
  scores[0].user_id = bob.osuUserId;
  metadataReply = () => Response.json({ ...metadata, max_combo: 0 });
  const response = await request(bounty.id);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "UNAVAILABLE_BEATMAP_METADATA");
});
