import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import Module from "node:module";
import { after, before, beforeEach, mock, test } from "node:test";
import express, { type ErrorRequestHandler } from "express";
import type { BountyContribution, User } from "@marksman/contracts";
import {
  BountyNotFoundError, BountyNotOpenError, BountyRewardLimitError,
  ContributionIdempotencyConflictError, InsufficientBpError, UserNotFoundError,
} from "../src/services/errors";

// Route boundary tests: fixture sessions and mocked DB/service calls; no database.
Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001", FRONTEND_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test",
  OSU_CLIENT_ID: "123", OSU_CLIENT_SECRET: "fixture-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const originals = new Map<string, NodeJS.Module | undefined>();
function stubModule(path: string, overrides: Record<string, unknown>) {
  const resolved = require.resolve(path);
  const original = require(path);
  originals.set(resolved, require.cache[resolved]);
  const replacement = new Module(resolved);
  replacement.exports = { ...original, ...overrides };
  replacement.loaded = true;
  require.cache[resolved] = replacement;
}
stubModule("../src/db/users", { findUserById: async () => user });
stubModule("../src/services/bounty-contributions", {
  contributeToBounty: async (...args: unknown[]) => {
    calls.push(args);
    if (failure) throw failure;
    return contribution;
  },
});
const { bountiesRouter } = require("../src/routes/bounties") as typeof import("../src/routes/bounties");
const { pool } = require("../src/db") as typeof import("../src/db");
const user: User = {
  identity: { id: randomUUID(), osuUserId: 101, username: "fixture", coverUrl: null, countryCode: null, countryName: null },
  stats: { bpBalance: 100 }, createdAt: new Date().toISOString(),
};
const bountyId = randomUUID();
const input = { amountBp: 10, idempotencyKey: randomUUID() };
const contribution: BountyContribution = {
  id: randomUUID(), bountyId, userId: user.identity.id,
  amountBp: 10, feeBp: 1, createdAt: new Date().toISOString(),
};
let server: Server;
let baseUrl: string;
let calls: unknown[][];
let failure: Error | undefined;
let forwardedError: unknown;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // Session persistence is outside this route test's scope.
    req.session = { userId: req.get("X-Fixture-User") } as typeof req.session;
    next();
  });
  app.use("/bounties", bountiesRouter);
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    forwardedError = error;
    res.status(500).json({ code: "INTERNAL_ERROR", error: "Internal server error" });
  };
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  mock.restoreAll();
  calls = [];
  failure = undefined;
  forwardedError = undefined;
});
after(async () => {
  mock.restoreAll();
  for (const [path, original] of originals) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
  if (server) await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
  await pool.end();
});

async function request({ id = bountyId as string, body = input as unknown, auth = true, origin = "http://localhost:3000" as string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["X-Fixture-User"] = user.identity.id;
  if (origin !== null) headers.Origin = origin;
  return fetch(`${baseUrl}/bounties/${id}/contributions`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

test("returns contribution and replays with 200 using session identity", async () => {
  for (let i = 0; i < 2; i++) {
    const response = await request({ body: { ...input, userId: randomUUID() } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), contribution);
  }
  assert.deepEqual(calls, Array(2).fill([bountyId, user.identity.id, input]));
});
test("requires authentication before calling contribution service", async () => {
  assert.equal((await request({ auth: false })).status, 401);
  assert.equal(calls.length, 0);
});
for (const origin of [null, "null", "https://attacker.example"]) {
  test(`rejects untrusted origin ${origin}`, async () => {
    assert.equal((await request({ origin })).status, 403);
    assert.equal(calls.length, 0);
  });
}
test("rejects malformed bounty ID without calling service", async () => {
  const response = await request({ id: "bad-id" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "MALFORMED_BOUNTY_ID");
  assert.equal(calls.length, 0);
});
test("returns body validation issues without calling service", async () => {
  const response = await request({ body: { amountBp: 0, idempotencyKey: "bad-key" } });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, "MALFORMED_BOUNTY_CONTRIBUTION");
  assert.deepEqual(body.details.map((issue: { path: string[] }) => issue.path), [["amountBp"], ["idempotencyKey"]]);
  assert.equal(calls.length, 0);
});
for (const [error, status, code] of [
  [new BountyNotFoundError(), 404, "BOUNTY_NOT_FOUND"],
  [new UserNotFoundError(), 404, "USER_NOT_FOUND"],
  [new BountyNotOpenError(), 409, "BOUNTY_NOT_OPEN"],
  [new BountyRewardLimitError(), 409, "BOUNTY_REWARD_LIMIT"],
  [new ContributionIdempotencyConflictError(), 409, "CONTRIBUTION_IDEMPOTENCY_CONFLICT"],
  [new InsufficientBpError(), 409, "INSUFFICIENT_BP"],
] as const) {
  test(`maps ${error.constructor.name} to ${status} ${code}`, async () => {
    failure = error;
    const response = await request();
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { code, error: error.message });
    assert.equal(forwardedError, undefined);
  });
}
test("forwards unexpected errors to Express error handling", async () => {
  failure = new Error("fixture write failure");
  const response = await request();
  assert.equal(response.status, 500);
  assert.equal(forwardedError, failure);
  assert.deepEqual(await response.json(), { code: "INTERNAL_ERROR", error: "Internal server error" });
});
