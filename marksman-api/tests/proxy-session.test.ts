import assert from "node:assert/strict";
import Module from "node:module";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { Router } from "express";
import session from "express-session";

Object.assign(process.env, {
  NODE_ENV: "production", PORT: "3001",
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
  FRONTEND_URL: "https://marksman.example",
  OSU_CLIENT_ID: "123", OSU_CLIENT_SECRET: "fixture-only",
  OSU_REDIRECT_URI: "https://api.marksman.example/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
  TRUST_PROXY_HOPS: "1",
});

// Load the real app/session middleware with in-memory persistence and fixture
// routes. No database, OAuth integration or worker modules are loaded.
const originals = new Map<string, NodeModule | undefined>();
function stub(path: string, exports: unknown) {
  const resolved = require.resolve(path);
  originals.set(resolved, require.cache[resolved]);
  const module = new Module(resolved);
  module.exports = exports;
  module.loaded = true;
  require.cache[resolved] = module;
}
stub("../src/db/session-store", { sessionStore: new session.MemoryStore() });
for (const [file, name] of [
  ["bounties", "bountiesRouter"], ["users", "usersRouter"],
  ["beatmaps", "beatmapsRouter"], ["economy", "economyRouter"],
  ["hunt", "huntsRouter"], ["health", "healthRouter"],
] as const) stub(`../src/routes/${file}`, { [name]: Router() });
const fixtureAuth = Router();
fixtureAuth.get("/probe", (req, res) => {
  req.session.oauthState = "fixture-state";
  res.json({ secure: req.secure, ip: req.ip });
});
stub("../src/routes/auth", { authRouter: fixtureAuth });
const { app } = require("../src/app") as typeof import("../src/app");
let server: Server;
let url: string;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  url = `http://127.0.0.1:${address.port}/auth/probe`;
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

test("configured single proxy permits secure session cookies for forwarded HTTPS", async () => {
  assert.equal(app.get("trust proxy"), 1);
  const response = await fetch(url, { headers: {
    "X-Forwarded-Proto": "https",
    "X-Forwarded-For": "198.51.100.9, 203.0.113.7",
  } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { secure: true, ip: "203.0.113.7" });
  const cookie = response.headers.get("set-cookie");
  assert(cookie);
  assert.match(cookie, /marksman\.sid=/);
  assert.match(cookie, /; Secure/i);
  assert.match(cookie, /; HttpOnly/i);
  assert.match(cookie, /; SameSite=Lax/i);
});

test("plain HTTP does not issue a production session cookie", async () => {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).secure, false);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("disabled proxy trust ignores forwarded HTTPS", async () => {
  app.set("trust proxy", 0);
  try {
    const response = await fetch(url, { headers: { "X-Forwarded-Proto": "https" } });
    assert.equal((await response.json()).secure, false);
    assert.equal(response.headers.get("set-cookie"), null);
  } finally { app.set("trust proxy", 1); }
});

test("proxy configuration defaults to zero and rejects unsupported hop values", () => {
  const path = require.resolve("../src/config");
  const original = require.cache[path];
  const saved = process.env.TRUST_PROXY_HOPS;
  try {
    delete process.env.TRUST_PROXY_HOPS;
    delete require.cache[path];
    assert.equal(require("../src/config").config.TRUST_PROXY_HOPS, 0);
    for (const value of ["-1", "2", "0.5", "true"]) {
      process.env.TRUST_PROXY_HOPS = value;
      delete require.cache[path];
      assert.throws(() => require("../src/config"));
    }
  } finally {
    if (saved === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = saved;
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
});
