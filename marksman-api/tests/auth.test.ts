import assert from "node:assert/strict";
import { metadata } from "./fixtures/completion";
import { createTestDatabase } from "./fixtures/test-database";
import { fork } from "node:child_process";
import { once } from "node:events";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { after, before, beforeEach, mock, test } from "node:test";
import { eq } from "drizzle-orm";
import { bounties, ledgerEntries, sessions, users } from "../src/db/schema";

// Set every configuration value before importing the real app. No live OAuth
// credentials or development database are used by this suite.
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "3001",
  DATABASE_URL:
    "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_auth_tests&options=-c%20statement_timeout%3D10000",
  FRONTEND_URL: "http://localhost:3000/",
  OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "test-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "test-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { app } = require("../src/app") as typeof import("../src/app");
const { sessionStore } =
  require("../src/db/session-store") as typeof import("../src/db/session-store");

const httpFetch = globalThis.fetch;
const frontend = "http://localhost:3000/";
const profile = { id: 12345, username: "test_player" };
let server: Server | undefined;
let baseUrl: string;
const testDatabase = createTestDatabase(db, true);
let upstreamCalls: string[];
let tokenReply: () => Response | Promise<Response>;
let profileReply: () => Response | Promise<Response>;

before(async () => {
  await testDatabase.prepare();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Local HTTP uses the captured real fetch. Every app-side fetch is intercepted,
  // and unknown URLs fail rather than reaching the internet.
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    upstreamCalls.push(url);
    if (url === "https://osu.ppy.sh/oauth/token") {
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init.headers).get("Content-Type"), "application/x-www-form-urlencoded");
      assert.ok(init.body instanceof URLSearchParams);
      if (init.body.get("grant_type") === "client_credentials") {
        assert.deepEqual(Object.fromEntries(init.body), {
          client_id: "123", client_secret: "test-client-secret",
          grant_type: "client_credentials", scope: "public",
        });
        return Response.json({ access_token: "metadata-token", token_type: "Bearer", expires_in: 3600 });
      }
      assert.deepEqual(Object.fromEntries(init.body), {
        client_id: "123",
        client_secret: "test-client-secret",
        code: "test-code",
        grant_type: "authorization_code",
        redirect_uri: "http://localhost:3001/auth/osu/callback",
      });
      return tokenReply();
    }
    if (url === "https://osu.ppy.sh/api/v2/me") {
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
      return profileReply();
    }
    if (url === "https://osu.ppy.sh/api/v2/beatmaps/123") {
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer metadata-token");
      return Response.json(metadata);
    }
    throw new Error(`Unexpected upstream URL: ${url}`);
  });
});

beforeEach(async () => {
  await testDatabase.clear();
  upstreamCalls = [];
  tokenReply = () => Response.json({ access_token: "test-token", token_type: "Bearer", expires_in: 3600 });
  profileReply = () => Response.json(profile);
});

after(async () => {
  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
        server!.closeAllConnections();
      });
    }
    sessionStore.close();
    await testDatabase.clearIfMigrated();
  } finally {
    mock.restoreAll();
    await db.$client.end();
  }
});

async function request(path: string, cookie?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("Cookie", cookie);
  const response = await httpFetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
  if (path.startsWith("/auth/")) {
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  return response;
}

function cookieFrom(response: Response) {
  const header = response.headers.get("Set-Cookie");
  assert.ok(header);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  assert.match(header, /Path=\//i);
  return header.split(";")[0];
}

async function startLogin() {
  const response = await request("/auth/osu");
  assert.equal(response.status, 302);
  const url = new URL(response.headers.get("Location")!);
  assert.equal(url.origin + url.pathname, "https://osu.ppy.sh/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("scope"), "identify");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3001/auth/osu/callback");
  const state = url.searchParams.get("state")!;
  assert.match(state, /^[a-f0-9]{64}$/);
  return { state, cookie: cookieFrom(response) };
}

function callback(state: string, cookie?: string) {
  return request(`/auth/osu/callback?code=test-code&state=${state}`, cookie);
}

async function assertNotLoggedIn(cookie?: string) {
  const response = await request("/auth/me", cookie);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    code: "NOT_LOGGED_IN",
    error: "Not logged in",
  });
}

test("login persists state, replaces the session, authenticates /me, and logs out", async () => {
  await assertNotLoggedIn();
  const start = await startLogin();
  const [pending] = await db.select().from(sessions);
  const pendingData = pending.sess as Record<string, unknown>;
  assert.equal(pendingData.oauthState, start.state);
  assert.ok(Number(pendingData.oauthStateExpiresAt) > Date.now());
  assert.ok(Number(pendingData.oauthStateExpiresAt) <= Date.now() + 10 * 60 * 1000);

  const response = await callback(start.state, start.cookie);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), frontend);
  const cookie = cookieFrom(response);
  assert.notEqual(cookie, start.cookie);
  const [user] = await db.select().from(users);
  assert.equal(user.username, profile.username);
  assert.equal(user.bpBalance, 330);
  const entries = await db.select().from(ledgerEntries);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries.map(({ userId, amount, reason, bountyId }) => ({ userId, amount, reason, bountyId })), [{
    userId: user.id, amount: 330, reason: "initial_grant", bountyId: null,
  }]);
  const storedSessions = await db.select().from(sessions);
  assert.equal(storedSessions.length, 1);
  assert.notEqual(storedSessions[0].sid, pending.sid);
  const data = storedSessions[0].sess as Record<string, unknown>;
  assert.equal(data.userId, user.id);
  assert.equal(data.oauthState, undefined);
  assert.equal(data.oauthStateExpiresAt, undefined);
  assert.equal(JSON.stringify(data).includes("test-token"), false);

  const me = await request("/auth/me", cookie);
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), {
    identity: { id: user.id, username: profile.username, osuUserId: profile.id },
    stats: { bpBalance: 330 },
    createdAt: user.createdAt.toISOString(),
  });
  await assertNotLoggedIn(start.cookie);
  assert.equal((await callback(start.state, cookie)).status, 400);
  assert.equal(upstreamCalls.length, 2);

  const logout = await request("/auth/logout", cookie, { method: "POST", headers: { Origin: "http://localhost:3000" } });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("Set-Cookie")!, /marksman\.sid=;/);
  assert.deepEqual(await db.select().from(sessions), []);
  await assertNotLoggedIn(cookie);
});

test("repeat OAuth login refreshes username and preserves UUID and BP", async () => {
  const [original] = await db.insert(users).values({ osuUserId: profile.id, username: "old_name", bpBalance: 250 }).returning();
  await db.insert(ledgerEntries).values({ userId: original.id, amount: 250, reason: "initial_grant" });
  const originalLedger = await db.select().from(ledgerEntries);
  const start = await startLogin();
  const response = await callback(start.state, start.cookie);
  assert.equal(response.status, 302);
  assert.deepEqual(await db.select().from(ledgerEntries), originalLedger);
  const me = await request("/auth/me", cookieFrom(response));
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), {
    identity: { id: original.id, username: profile.username, osuUserId: profile.id },
    stats: { bpBalance: 250 },
    createdAt: original.createdAt.toISOString(),
  });
  const rows = await db.select().from(users);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { ...original, username: profile.username });
});

for (const scenario of ["missing", "malformed", "mismatched", "expired", "no-session", "both-code-and-error", "missing-code"] as const) {
  test(`OAuth rejects ${scenario} callback without contacting osu!`, async () => {
    const start = await startLogin();
    if (scenario === "expired") {
      const [row] = await db.select().from(sessions);
      await db.update(sessions).set({ sess: { ...(row.sess as object), oauthStateExpiresAt: Date.now() - 1 } }).where(eq(sessions.sid, row.sid));
    }
    const params = new URLSearchParams({ code: "test-code", state: start.state });
    if (scenario === "missing") params.delete("state");
    if (scenario === "malformed") params.set("state", "invalid");
    if (scenario === "mismatched") params.set("state", (start.state[0] === "a" ? "b" : "a") + start.state.slice(1));
    if (scenario === "both-code-and-error") params.set("error", "access_denied");
    if (scenario === "missing-code") params.delete("code");
    const response = await request(`/auth/osu/callback?${params}`, scenario === "no-session" ? undefined : start.cookie);
    assert.equal(response.status, 400);
    assert.deepEqual(upstreamCalls, []);
    assert.deepEqual(await db.select().from(users), []);
    await assertNotLoggedIn(start.cookie);
  });
}

for (const [error, outcome] of [["access_denied", "cancelled"], ["server_error", "failed"]]) {
  test(`OAuth ${error} redirects with ${outcome} and consumes state`, async () => {
    const start = await startLogin();
    const response = await request(`/auth/osu/callback?error=${error}&state=${start.state}`, start.cookie);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), `${frontend}?login=${outcome}`);
    assert.equal((await callback(start.state, start.cookie)).status, 400);
    assert.deepEqual(upstreamCalls, []);
    assert.deepEqual(await db.select().from(users), []);
    await assertNotLoggedIn(start.cookie);
  });
}

for (const stage of ["token", "profile"] as const) {
  for (const failure of ["http", "invalid-payload", "network", "timeout"] as const) {
    test(`${stage} ${failure} failure returns generic 502 and consumes state`, async () => {
      const reply = () => {
        if (failure === "http") return new Response("private upstream details", { status: 503 });
        if (failure === "invalid-payload") return Response.json({ unexpected: "private upstream details" });
        if (failure === "timeout") throw new DOMException("private timeout details", "TimeoutError");
        throw new Error("private network details");
      };
      if (stage === "token") tokenReply = reply;
      else profileReply = reply;
      const start = await startLogin();
      const response = await callback(start.state, start.cookie);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), {
        code: "UPSTREAM_IDENTITY_VERIFICATION_FAILURE",
        error: "Unable to complete osu! identity verification",
      });
      assert.equal((await callback(start.state, start.cookie)).status, 400);
      assert.equal(upstreamCalls.length, stage === "token" ? 1 : 2);
      assert.deepEqual(await db.select().from(users), []);
      await assertNotLoggedIn(start.cookie);
    });
  }
}

async function login() {
  const start = await startLogin();
  const response = await callback(start.state, start.cookie);
  assert.equal(response.status, 302);
  return cookieFrom(response);
}

const bountyInput = {
  rewardBp: 30,
  goal: { type: "minimum_grade", beatmapId: 123, minimumGradeRequirement: "A" },
};
const trustedHeaders = { Origin: "http://localhost:3000", "Content-Type": "application/json" };

for (const origin of [undefined, "http://untrusted.example", "null"]) {
  test(`authenticated mutations reject Origin ${origin ?? "missing"} without side effects`, async () => {
    const cookie = await login();
    await db.update(users).set({ bpBalance: 100 });
    const created = await request("/bounties", cookie, {
      method: "POST", headers: trustedHeaders, body: JSON.stringify(bountyInput),
    });
    assert.equal(created.status, 201);
    const { bounty } = await created.json();
    const originalUsers = await db.select().from(users);
    const originalBounties = await db.select().from(bounties);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (origin !== undefined) headers.Origin = origin;
    for (const path of ["/bounties", `/bounties/${bounty.id}/cancel`, "/auth/logout"]) {
      const response = await request(path, cookie, { method: "POST", headers, body: JSON.stringify(bountyInput) });
      assert.equal(response.status, 403, path);
      assert.deepEqual(await db.select().from(users), originalUsers);
      assert.deepEqual(await db.select().from(bounties), originalBounties);
      assert.equal((await request("/auth/me", cookie)).status, 200);
    }
    const cancelled = await request(`/bounties/${bounty.id}/cancel`, cookie, { method: "POST", headers: trustedHeaders });
    assert.equal(cancelled.status, 200);
    assert.equal((await db.select().from(users))[0].bpBalance, 97);
    assert.equal((await request(`/bounties/${bounty.id}/cancel`, cookie, { method: "POST", headers: trustedHeaders })).status, 409);
    assert.equal((await db.select().from(users))[0].bpBalance, 97);
  });
}

test("a different authenticated user cannot cancel a bounty or receive a refund", async () => {
  const ownerCookie = await login();
  await db.update(users).set({ bpBalance: 100 });
  const created = await request("/bounties", ownerCookie, { method: "POST", headers: trustedHeaders, body: JSON.stringify(bountyInput) });
  assert.equal(created.status, 201);
  const { bounty } = await created.json();
  profileReply = () => Response.json({ id: 67890, username: "other_player" });
  const otherCookie = await login();
  const originalUsers = await db.select().from(users).orderBy(users.osuUserId);
  const originalBounties = await db.select().from(bounties);
  const rejected = await request(`/bounties/${bounty.id}/cancel`, otherCookie, { method: "POST", headers: trustedHeaders });
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).code, "BOUNTY_NOT_OWNED");
  assert.deepEqual(await db.select().from(users).orderBy(users.osuUserId), originalUsers);
  assert.deepEqual(await db.select().from(bounties), originalBounties);
  assert.equal((await request(`/bounties/${bounty.id}/cancel`, ownerCookie, { method: "POST", headers: trustedHeaders })).status, 200);
});

test("expired PostgreSQL sessions reject an otherwise valid login cookie", async () => {
  const cookie = await login();
  await db.update(sessions).set({ expire: new Date(Date.now() - 60_000) });
  await assertNotLoggedIn(cookie);
  assert.equal(upstreamCalls.length, 2);
});

test("a deleted account cannot authenticate with its existing session", async () => {
  const cookie = await login();
  await db.delete(ledgerEntries);
  await db.delete(users);
  await assertNotLoggedIn(cookie);
});

test("logout store failure preserves the cookie and allows a successful retry", async (t) => {
  const cookie = await login();
  const originalSessions = await db.select().from(sessions);
  const destroy = t.mock.method(sessionStore, "destroy", (...[_sid, done]: Parameters<typeof sessionStore.destroy>) => done?.(new Error("Simulated store failure")));
  const log = t.mock.method(console, "error", () => {});
  const response = await request("/auth/logout", cookie, { method: "POST", headers: trustedHeaders });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    code: "UNEXPECTED_ERROR",
    error: "Internal server error",
  });
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.deepEqual(await db.select().from(sessions), originalSessions);
  assert.equal(log.mock.callCount(), 1);
  destroy.mock.restore();
  assert.equal((await request("/auth/me", cookie)).status, 200);
  assert.equal((await request("/auth/logout", cookie, { method: "POST", headers: trustedHeaders })).status, 204);
  await assertNotLoggedIn(cookie);
});

test("a login remains valid across fresh API processes", { timeout: 15_000 }, async () => {
  const cookie = await login();
  const expected = await (await request("/auth/me", cookie)).json();
  // Each child creates a fresh Express app, PostgreSQL pool, and session store.
  for (let restart = 0; restart < 2; restart++) {
    const child = fork(resolve(__dirname, "fixtures/auth-server.ts"), [], {
      execArgv: ["--import", "tsx"],
      env: process.env,
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    const exit = once(child, "exit");
    try {
      const [message] = await Promise.race([
        once(child, "message"),
        exit.then(() => { throw new Error("API fixture exited before listening"); }),
      ]);
      const response = await httpFetch(`http://127.0.0.1:${message.port}/auth/me`, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected);
      child.send("stop");
      const [code] = await exit;
      assert.equal(code, 0);
    } finally {
      if (child.exitCode === null) child.kill();
      await exit;
    }
  }
});

test("concurrent callbacks must claim OAuth state only once", {
  todo: "Known race: session read/modify/save is not an atomic state claim",
  timeout: 10_000,
}, async (t) => {
  const start = await startLogin();
  const originalGet = sessionStore.get.bind(sessionStore);
  const deliveries: Array<() => void> = [];
  // Both requests read the real stored state before either handler can clear it.
  const get = t.mock.method(sessionStore, "get", (...[sid, done]: Parameters<typeof sessionStore.get>) => {
    originalGet(sid, (error, session) => {
      deliveries.push(() => done(error, session));
      if (deliveries.length === 2) deliveries.splice(0).forEach((deliver) => deliver());
    });
  });
  const fallback = setTimeout(() => {
    get.mock.restore();
    deliveries.splice(0).forEach((deliver) => deliver());
  }, 3000);
  try {
    const responses = await Promise.all([callback(start.state, start.cookie), callback(start.state, start.cookie)]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [302, 400]);
    assert.equal(upstreamCalls.filter((url) => url.endsWith("/oauth/token")).length, 1);
  } finally {
    clearTimeout(fallback);
    get.mock.restore();
    deliveries.splice(0).forEach((deliver) => deliver());
  }
});
