import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { detailedUserSchema, userSchema } from "@marksman/contracts";
import { bounties, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { qualifyingBounty } from "./fixtures/completion";

Object.assign(process.env, {
  NODE_ENV: "test", PORT: "3001",
  DATABASE_URL: "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_profile_tests&options=-c%20statement_timeout%3D10000",
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
let target: typeof users.$inferSelect;
let viewer: typeof users.$inferSelect;

before(async () => {
  await testDatabase.prepare();
  mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected upstream request"); });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await testDatabase.clear();
  [target, viewer] = await db.insert(users).values([
    { osuUserId: 42, username: "profile-target", bpBalance: 123 },
    { osuUserId: 43, username: "viewer", bpBalance: 456 },
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

async function viewerCookie() {
  const sid = randomUUID();
  const expire = new Date(Date.now() + 60_000);
  await db.insert(sessions).values({ sid, expire, sess: {
    cookie: { originalMaxAge: 60_000, expires: expire.toISOString(), httpOnly: true, path: "/", sameSite: "lax" },
    userId: viewer.id,
  } });
  const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(sid).digest("base64").replace(/=+$/, "");
  return `marksman.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}

test("public profile returns DetailedUser with numeric zero stats", async () => {
  const response = await httpFetch(`${baseUrl}/users/${target.id}`);
  assert.equal(response.status, 200);
  const profile = detailedUserSchema.parse(await response.json());
  assert.equal(profile.identity.id, target.id);
  assert.equal(profile.createdAt, target.createdAt.toISOString());
  assert.deepEqual(profile.stats, { bpBalance: 123, bountiesWon: 0, bountyEarningsBp: 0 });
});

test("profile aggregates belong to the viewed user for anonymous and signed-in visitors", async () => {
  const base = { creatorOsuUserId: viewer.osuUserId, goal: qualifyingBounty().goal };
  await db.insert(bounties).values([
    { ...base, status: "completed", completedByOsuUserId: target.osuUserId, rewardBp: 100 },
    { ...base, status: "completed", completedByOsuUserId: target.osuUserId, rewardBp: 100 },
    { ...base, creatorOsuUserId: target.osuUserId, status: "completed", completedByOsuUserId: viewer.osuUserId, rewardBp: 900 },
    { ...base, status: "cancelled", completedByOsuUserId: target.osuUserId, rewardBp: 900 },
    { ...base, status: "open", rewardBp: 900 },
    { ...base, status: "completed", completedByOsuUserId: null, rewardBp: 900 },
  ]);
  const cookie = await viewerCookie();
  const visitors: Record<string, string>[] = [{}, { cookie }];
  for (const headers of visitors) {
    const response = await httpFetch(`${baseUrl}/users/${target.id}`, { headers });
    assert.equal(response.status, 200);
    const profile = detailedUserSchema.parse(await response.json());
    assert.equal(profile.identity.id, target.id);
    assert.deepEqual(profile.stats, { bpBalance: 123, bountiesWon: 2, bountyEarningsBp: 200 });
  }
  const response = await httpFetch(`${baseUrl}/users/${viewer.id}`);
  assert.deepEqual(detailedUserSchema.parse(await response.json()).stats, { bpBalance: 456, bountiesWon: 1, bountyEarningsBp: 900 });
});

test("base user list and authenticated account responses retain their base contract", async () => {
  const listing = await httpFetch(`${baseUrl}/users`);
  assert.equal(listing.status, 200);
  const listed = await listing.json() as unknown[];
  assert.equal(listed.length, 2);
  for (const user of listed) {
    userSchema.parse(user);
    assert.deepEqual(Object.keys((user as { stats: object }).stats), ["bpBalance"]);
  }
  const account = await httpFetch(`${baseUrl}/auth/me`, { headers: { cookie: await viewerCookie() } });
  assert.equal(account.status, 200);
  const body = await account.json();
  assert.equal(userSchema.parse(body).identity.id, viewer.id);
  assert.deepEqual(body.stats, { bpBalance: 456 });
});

test("profile keeps structured malformed and missing-user errors", async () => {
  for (const [id, status, code] of [["invalid", 400, "MALFORMED_USER_ID"], [randomUUID(), 404, "USER_NOT_FOUND"]] as const) {
    const response = await httpFetch(`${baseUrl}/users/${id}`);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
});
