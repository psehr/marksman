import assert from "node:assert/strict";
import Module from "node:module";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { Router, type Request, type Response } from "express";
import session from "express-session";

Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
  FRONTEND_URL: "http://localhost:3000", OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-only",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
  ALLOWED_OSU_USER_IDS: "123,456", TRUST_PROXY_HOPS: "0",
});

const originals = new Map<string, NodeModule | undefined>();
function stub(path: string, exports: unknown) {
  const resolved = require.resolve(path);
  originals.set(resolved, require.cache[resolved]);
  const module = new Module(resolved);
  module.exports = exports;
  module.loaded = true;
  require.cache[resolved] = module;
}

let lookups = 0;
let lookupError: Error | undefined;
const identities = new Map([
  ["allowed", 123], ["also-allowed", 456], ["denied", 789],
]);
stub("../src/db/users", {
  async findUserById(id: string) {
    lookups++;
    if (lookupError) throw lookupError;
    const osuUserId = identities.get(id);
    return osuUserId === undefined ? undefined : { identity: { id, osuUserId } };
  },
});
stub("../src/db/session-store", { sessionStore: new session.MemoryStore() });
// Only route ordering is under test here; route business logic stays isolated.
for (const [file, name] of [
  ["bounties", "bountiesRouter"], ["users", "usersRouter"],
  ["beatmaps", "beatmapsRouter"], ["economy", "economyRouter"],
  ["hunt", "huntsRouter"], ["health", "healthRouter"],
] as const) {
  const router = Router();
  router.get("/", (_req, res) => { res.json({ reached: file }); });
  router.post("/", (_req, res) => { res.json({ reached: file }); });
  stub(`../src/routes/${file}`, { [name]: router });
}
const auth = Router();
auth.get("/fixture-login/:id", (req, res) => {
  req.session.userId = req.params.id;
  res.json({ loggedIn: true });
});
for (const path of ["/osu", "/osu/callback", "/me"]) {
  auth.get(path, (_req, res) => { res.json({ reached: path }); });
}
auth.post("/logout", (_req, res) => { res.sendStatus(204); });
stub("../src/routes/auth", { authRouter: auth });

const { config, allowlistSchema } = require("../src/config") as typeof import("../src/config");
const { requireAlphaAccess } = require("../src/middleware/requireAlphaAccess") as typeof import("../src/middleware/requireAlphaAccess");
const { app } = require("../src/app") as typeof import("../src/app");
let server: Server;
let base: string;
async function login(id: string) {
  const response = await fetch(`${base}/auth/fixture-login/${id}`);
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  return cookie.split(";")[0]!;
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  for (const [path, original] of originals) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
});

test("allowlist parses missing/blank config closed, trims IDs, and rejects invalid values", () => {
  for (const value of [undefined, "", "   "]) assert.deepEqual(allowlistSchema.parse(value), []);
  assert.deepEqual(allowlistSchema.parse(" 123, 456 "), [123, 456]);
  for (const value of ["abc", "0", "-1", "1.5", "123,", ",123", "123,,456", "Infinity", "9007199254740992"]) {
    assert.equal(allowlistSchema.safeParse(value).success, false, value);
  }
});

for (const route of ["bounties", "users", "beatmaps", "economy", "hunts"]) {
  test(`${route}: signed-out and denied requests cannot reach GET or POST handlers`, async () => {
    const cookie = await login("denied");
    for (const method of ["GET", "POST"]) {
      const anonymous = await fetch(`${base}/${route}`, { method });
      assert.equal(anonymous.status, 401);
      assert.equal((await anonymous.json()).code, "NOT_LOGGED_IN");
      const denied = await fetch(`${base}/${route}`, { method, headers: { cookie } });
      assert.equal(denied.status, 403);
      assert.equal((await denied.json()).code, "ALPHA_ACCESS_REQUIRED");
    }
  });
  test(`${route}: allowlisted identity reaches the handler`, async () => {
    const cookie = await login("also-allowed");
    const response = await fetch(`${base}/${route}`, { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reached, route === "hunts" ? "hunt" : route);
  });
}

test("health and auth bootstrap/logout bypass the gate for anonymous and denied sessions", async () => {
  const cookie = await login("denied");
  for (const headers of [new Headers(), new Headers({ cookie })]) {
    for (const path of ["/health", "/auth/osu", "/auth/osu/callback", "/auth/me"]) {
      const response = await fetch(`${base}${path}`, { headers });
      assert.equal(response.status, 200, path);
    }
    assert.equal((await fetch(`${base}/auth/logout`, { method: "POST", headers })).status, 204);
  }
});

test("missing user returns 401 and each request rechecks the stored identity", async () => {
  const missing = await login("missing");
  assert.equal((await fetch(`${base}/bounties`, { headers: { cookie: missing } })).status, 401);
  const cookie = await login("allowed");
  assert.equal((await fetch(`${base}/bounties`, { headers: { cookie } })).status, 200);
  identities.set("allowed", 789);
  try {
    assert.equal((await fetch(`${base}/bounties`, { headers: { cookie } })).status, 403);
    identities.delete("allowed");
    assert.equal((await fetch(`${base}/bounties`, { headers: { cookie } })).status, 401);
  } finally { identities.set("allowed", 123); }
});

test("lookup errors reach the central handler as 500 rather than allowing access", async () => {
  const cookie = await login("allowed");
  lookupError = new Error("fixture lookup failure");
  const original = console.error;
  console.error = () => {};
  try {
    const response = await fetch(`${base}/bounties`, { headers: { cookie } });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { code: "UNEXPECTED_ERROR", error: "Internal server error" });
  } finally { lookupError = undefined; console.error = original; }
});

test("signed-out middleware exits before database lookup", async () => {
  const count = lookups;
  const response = await fetch(`${base}/bounties`);
  assert.equal(response.status, 401);
  assert.equal(lookups, count);
});

test("reloaded config revokes an existing session and an empty list denies everyone", async () => {
  // Reload the middleware as a server restart would, preserving the browser session.
  const cookie = await login("allowed");
  assert.equal((await fetch(`${base}/bounties`, { headers: { cookie } })).status, 200);
  const path = require.resolve("../src/middleware/requireAlphaAccess");
  const original = require.cache[path];
  const saved = config.ALLOWED_OSU_USER_IDS;
  try {
    for (const ids of [[456], []]) {
      config.ALLOWED_OSU_USER_IDS = ids;
      delete require.cache[path];
      const reloaded = require("../src/middleware/requireAlphaAccess").requireAlphaAccess as typeof requireAlphaAccess;
      // Exercise the freshly initialized gate with the existing session's user ID.
      const request = { session: { userId: "allowed" } } as Request;
      let status: number | undefined;
      const response = {
        status(value: number) { status = value; return this; },
        json(body: { code: string }) { assert.equal(body.code, "ALPHA_ACCESS_REQUIRED"); return this; },
      } as Response;
      await reloaded(request, response, () => assert.fail("revoked user must not pass"));
      assert.equal(status, 403);
    }
  } finally {
    config.ALLOWED_OSU_USER_IDS = saved;
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
});
