import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { bountySchema, type OsuBeatmapMetadata } from "@marksman/contracts";
import { bounties, ledgerEntries, bountyBeatmaps, sessions, users } from "../src/db/schema";
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
let creator: typeof users.$inferSelect;

const maps = new Map<number, OsuBeatmapMetadata>();
let nextMapId = 700000;
before(async () => {
  await testDatabase.prepare();
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url === "https://osu.ppy.sh/oauth/token") return Response.json({ access_token: "fixture-token", token_type: "Bearer", expires_in: 3600 });
    const id = Number(url.match(/\/beatmaps\/(\d+)$/)?.[1]);
    if (url.startsWith("https://osu.ppy.sh/api/v2/beatmaps/") && maps.has(id)) return Response.json(maps.get(id));
    throw new Error(`Unexpected upstream request: ${url}`);
  });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => {
  await testDatabase.clear();
  await db.delete(bountyBeatmaps);
  [creator] = await db.insert(users).values({ osuUserId: 7, username: "creator", bpBalance: 100 }).returning();
  await db.insert(ledgerEntries).values({ userId: creator.id, amount: 100, reason: "initial_grant" });

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
    await db.delete(bountyBeatmaps);
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

async function snapshot() {
  return {
    users: await db.select().from(users).orderBy(users.id),
    bounties: await db.select().from(bounties).orderBy(bounties.id),
    ledger: await db.select().from(ledgerEntries).orderBy(ledgerEntries.id),
    metadata: await db.select().from(bountyBeatmaps).orderBy(bountyBeatmaps.beatmapId),
  };
}
async function create(mode: OsuBeatmapMetadata["mode"], status: OsuBeatmapMetadata["status"]) {
  const id = ++nextMapId; // Avoid cached metadata from earlier cases.
  maps.set(id, { ...metadata, id, mode, status });
  return httpFetch(`${baseUrl}/bounties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", cookie: await cookieFor(creator.id) },
    body: JSON.stringify({ rewardBp: 30, goal: { ...qualifyingBounty().goal, beatmapId: id } }),
  });
}

for (const mode of ["osu", "mania", "taiko", "fruits"] as const) {
  for (const status of ["ranked", "approved", "loved", "qualified", "pending", "wip", "graveyard"] as const) {
    const allowed = mode === "osu" && ["ranked", "approved", "loved"].includes(status);
    test(`${mode}/${status}: ${allowed ? "funds and persists" : "returns 422 with no writes"}`, async () => {
      const before = await snapshot();
      const response = await create(mode, status);
      const body = await response.json();
      assert.equal(response.status, allowed ? 201 : 422);
      if (!allowed) {
        assert.equal(body.code, mode !== "osu" ? "UNSUPPORTED_MODE" : "UNSUPPORTED_BEATMAP_STATUS");
        assert.equal(body.error, mode !== "osu" ? "Only osu!standard beatmaps are supported" : "Only Ranked, Approved or Loved beatmaps are supported");
        assert.deepEqual(await snapshot(), before);
        return;
      }
      const created = bountySchema.parse(body.bounty);
      assert.equal(created.status, "open");
      assert.equal(created.goal.beatmapChecksum, metadata.checksum);
      const after = await snapshot();
      assert.equal(after.users[0].bpBalance, 67);
      assert.equal(after.bounties.length, 1);
      assert.equal(after.bounties[0].id, created.id);
      assert.equal(after.metadata.length, 1);
      assert.equal(after.metadata[0].metadata.stats.status, status);
      assert.deepEqual(after.ledger.map(row => [row.reason, row.amount]).sort(), [
        ["bounty_fee", -3], ["bounty_funding", -30], ["initial_grant", 100],
      ]);
    });
  }
}
