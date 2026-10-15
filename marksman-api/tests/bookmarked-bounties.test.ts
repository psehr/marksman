import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { extendedBountySchema, type Bounty } from "@marksman/contracts";
import { bounties, bountyBookmarks, sessions, users } from "../src/db/schema";
import { createTestDatabase } from "./fixtures/test-database";
import { metadata, qualifyingBounty } from "./fixtures/completion";

// Configure the isolated database before importing the application/pool.
Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "3001",
  DATABASE_URL:
    "postgresql://marksman_test:marksman_test@127.0.0.1:5433/marksman_test?application_name=marksman_bookmarked_tests&options=-c%20statement_timeout%3D10000",
  FRONTEND_URL: "http://localhost:3000/",
  OSU_CLIENT_ID: "123",
  OSU_CLIENT_SECRET: "fixture-client-secret",
  OSU_REDIRECT_URI: "http://localhost:3001/auth/osu/callback",
  SESSION_SECRET: "fixture-session-secret-at-least-32-characters",
});
const { db } = require("../src/db") as typeof import("../src/db");
const { app } = require("../src/app") as typeof import("../src/app");
const { sessionStore } =
  require("../src/db/session-store") as typeof import("../src/db/session-store");
const testDatabase = createTestDatabase(db, true);
const httpFetch = globalThis.fetch;
let server: Server | undefined;
let baseUrl: string;
let alice: typeof users.$inferSelect;
let bob: typeof users.$inferSelect;
let creator: typeof users.$inferSelect;
let beatmapId = 800000;
let upstreamCalls: string[] = [];
const allowedMaps = new Set<number>();

before(async () => {
  await testDatabase.prepare();
  mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0]) => {
      const url = input instanceof Request ? input.url : String(input);
      upstreamCalls.push(url);
      if (url === "https://osu.ppy.sh/oauth/token") {
        return Response.json({
          access_token: "fixture-token",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }
      const match = /^https:\/\/osu\.ppy\.sh\/api\/v2\/beatmaps\/(\d+)$/.exec(
        url,
      );
      if (match && allowedMaps.has(Number(match[1])))
        return Response.json(metadata);
      throw new Error(`Unexpected fetch: ${url}; live requests are disabled`);
    },
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await testDatabase.clear();
  upstreamCalls = [];
  allowedMaps.clear();
  [alice, bob, creator] = await db
    .insert(users)
    .values([
      { osuUserId: 42, username: "alice" },
      { osuUserId: 43, username: "bob" },
      { osuUserId: 7, username: "creator" },
    ])
    .returning();
});

after(async () => {
  try {
    if (server)
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
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
  await db.insert(sessions).values({
    sid,
    expire,
    sess: {
      cookie: {
        originalMaxAge: 60_000,
        expires: expire.toISOString(),
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      },
      userId,
    },
  });
  const signature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(sid)
    .digest("base64")
    .replace(/=+$/, "");
  return `marksman.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
}

async function seedBounty(status: Bounty["status"] = "open") {
  // Unique IDs prevent metadata cached in a previous test from masking requests.
  const mapId = ++beatmapId;
  allowedMaps.add(mapId);
  const [row] = await db
    .insert(bounties)
    .values({
      status,
      rewardBp: 30,
      creatorOsuUserId: creator.osuUserId,
      goal: { ...qualifyingBounty().goal, beatmapId: mapId },
      ...(status === "completed"
        ? {
            completedByOsuUserId: bob.osuUserId,
            completionScoreId: 987654,
            completedAt: new Date("2026-09-26T12:00:00Z"),
          }
        : {}),
    })
    .returning();
  return row;
}

async function request(userId?: string, query = "") {
  return httpFetch(`${baseUrl}/users/me/bookmarked-bounties${query}`, {
    headers: userId ? { Cookie: await cookieFor(userId) } : {},
  });
}

async function readBounties(response: Response) {
  assert.equal(response.status, 200);
  return extendedBountySchema.array().parse(await response.json());
}

test("bookmarks list rejects signed-out requests without upstream calls", async () => {
  const response = await request();
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    code: "NOT_LOGGED_IN",
    error: "Not logged in",
  });
  assert.deepEqual(upstreamCalls, []);
});

test("bookmarks list returns an empty array when only another user has bookmarks", async () => {
  const bounty = await seedBounty();
  await db
    .insert(bountyBookmarks)
    .values({ userId: bob.id, bountyId: bounty.id });
  assert.deepEqual(await readBounties(await request(alice.id)), []);
  assert.deepEqual(upstreamCalls, []);
});

test("bookmarks list isolates users, includes shared bookmarks once, and ignores supplied user IDs", async () => {
  const aliceOnly = await seedBounty();
  const bobOnly = await seedBounty();
  const shared = await seedBounty();
  await seedBounty(); // An unbookmarked bounty must not appear for either user.
  await db.insert(bountyBookmarks).values([
    { userId: alice.id, bountyId: aliceOnly.id },
    { userId: bob.id, bountyId: bobOnly.id },
    { userId: alice.id, bountyId: shared.id },
    { userId: bob.id, bountyId: shared.id },
  ]);
  const aliceResults = await readBounties(
    await request(alice.id, `?userId=${bob.id}`),
  );
  const bobResults = await readBounties(await request(bob.id));
  assert.deepEqual(
    aliceResults.map((b) => b.id).sort(),
    [aliceOnly.id, shared.id].sort(),
  );
  assert.deepEqual(
    bobResults.map((b) => b.id).sort(),
    [bobOnly.id, shared.id].sort(),
  );
  assert.equal(
    aliceResults.find((b) => b.id === shared.id)!.engagement.bookmarkCount,
    2,
  );
});

test("bookmarks list retains completed and cancelled bookmarks with enriched history", async () => {
  const open = await seedBounty();
  const completed = await seedBounty("completed");
  const cancelled = await seedBounty("cancelled");
  await db.insert(bountyBookmarks).values(
    [open, completed, cancelled].map((b) => ({
      userId: alice.id,
      bountyId: b.id,
    })),
  );
  const results = await readBounties(await request(alice.id));
  assert.deepEqual(
    results.map((b) => b.id).sort(),
    [open.id, completed.id, cancelled.id].sort(),
  );
  for (const bounty of results) {
    assert.deepEqual(bounty.beatmap, {
      url: metadata.url,
      version: { id: metadata.id, name: metadata.version },
      song: null,
      specs: {
        sr: metadata.difficulty_rating,
        ar: metadata.ar,
        od: metadata.accuracy,
        cs: metadata.cs,
        hp: metadata.drain,
        bpm: metadata.bpm,
        length: { total: metadata.total_length, drain: metadata.hit_length },
        maxCombo: metadata.max_combo,
      },
      covers: null,
      creator: null,
      stats: { status: metadata.status, playcount: metadata.playcount },
    });
    assert.deepEqual(bounty.owner, {
      id: creator.id,
      osuUserId: creator.osuUserId,
      username: creator.username,
    });
    assert.deepEqual(bounty.engagement, {
      bookmarkCount: 1,
      isBookmarkedByCurrentUser: null,
    });
    const stored = [open, completed, cancelled].find(
      (b) => b.id === bounty.id,
    )!;
    assert.equal(bounty.status, stored.status);
    assert.equal(bounty.createdAt, stored.createdAt.toISOString());
    if (bounty.id === completed.id) {
      assert.deepEqual(bounty.winner, {
        id: bob.id,
        osuUserId: bob.osuUserId,
        username: bob.username,
      });
      assert.equal(bounty.completedAt, completed.completedAt!.toISOString());
      assert.equal(bounty.completionScoreId, 987654);
    } else {
      assert.equal(bounty.winner, null);
      assert.equal(bounty.completedAt, null);
    }
  }
});
