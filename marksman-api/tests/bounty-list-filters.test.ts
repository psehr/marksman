import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import { bountyListResponseSchema, bountySearchQuerySchema, type Bounty, type BountyBeatmapMetadata } from "@marksman/contracts";
import { bounties, bountyBookmarks, bountyBeatmaps, sessions, users } from "../src/db/schema";
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
  await db.delete(bountyBeatmaps);
  [alice, bob, creator] = await db.insert(users).values([
    { osuUserId: 42, username: "alice" },
    { osuUserId: 43, username: "bob" },
    { osuUserId: 7, username: "UniqueOwner" },
  ]).returning();
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

async function seed(options: Partial<typeof bounties.$inferInsert> = {}) {
  const [row] = await db.insert(bounties).values({
    status: "open", rewardBp: 100, creatorOsuUserId: 7,
    goal: qualifyingBounty().goal, ...options,
  }).returning();
  return row;
}
async function list(query: Record<string, string> = {}, cookie?: string) {
  const response = await httpFetch(`${baseUrl}/bounties?${new URLSearchParams(query)}`, {
    headers: cookie ? { cookie } : {},
  });
  assert.equal(response.status, 200);
  return bountyListResponseSchema.parse(await response.json());
}
async function expectIds(query: Record<string, string>, ids: string[], cookie?: string) {
  const result = await list(query, cookie);
  assert.deepEqual(result.items.map(item => item.id).sort(), [...ids].sort());
  assert.equal(result.total, ids.length);
}

test("query defaults, CSV selections, duplicates and NM precedence", () => {
  const defaults = bountySearchQuerySchema.parse({});
  assert.deepEqual([defaults.tiers, defaults.goals, defaults.mods], [[], [], []]);
  const parsed = bountySearchQuerySchema.parse({ tiers: "Normal,Hard", goals: "full_combo,minimum_grade", mods: "HD,HD,HR", page: "2" });
  assert.deepEqual(parsed.mods, ["HD", "HR"]);
  assert.equal(parsed.page, 2);
  assert.deepEqual(bountySearchQuerySchema.parse({ mods: "HD,NM" }).mods, ["NM"]);
});

test("public default list excludes closed states and returns enriched items", async () => {
  const open = await seed();
  await seed({ status: "cancelled" });
  await seed({ status: "draft" });
  const completed = await seed({ status: "completed" });
  await expectIds({}, [open.id]);
  await expectIds({ status: "completed" }, [completed.id]);
  assert.equal((await list()).items[0].owner?.username, creator.username);
});

test("tier boundaries and disjoint tier selections", async () => {
  const rewards = [1, 99, 100, 299, 300, 999, 1000, 2999, 3000, 9999, 10000, 50000];
  const rows = [];
  for (const rewardBp of rewards) rows.push(await seed({ rewardBp }));
  for (const [index, tier] of ["Easy", "Normal", "Hard", "Lunatic", "Extra", "Phantasm"].entries()) {
    await expectIds({ tiers: tier }, rows.slice(index * 2, index * 2 + 2).map(row => row.id));
  }
  await expectIds({ tiers: "Normal,Phantasm" }, [rows[2], rows[3], rows[10], rows[11]].map(row => row.id));
});

test("goal filters support either, both and no selection", async () => {
  const fc = await seed();
  const grade = await seed({ goal: { ...qualifyingBounty().goal, type: "minimum_grade", minimumGradeRequirement: "A" } });
  await expectIds({ goals: "full_combo" }, [fc.id]);
  await expectIds({ goals: "minimum_grade" }, [grade.id]);
  await expectIds({ goals: "full_combo,minimum_grade" }, [fc.id, grade.id]);
});

test("mods require all selected mods and only exact/includes; NM is exact empty", async () => {
  const requirements: Bounty["goal"]["modRequirement"][] = [
    { rule: "any" }, { rule: "exact", mods: [] }, { rule: "exact", mods: ["HD"] },
    { rule: "exact", mods: ["HD", "HR"] }, { rule: "includes", mods: ["HD", "HR", "DT"] },
    { rule: "excludes", mods: ["HD", "HR"] },
  ];
  const rows = [];
  for (const modRequirement of requirements) rows.push(await seed({ goal: { ...qualifyingBounty().goal, modRequirement } }));
  await expectIds({ mods: "HD,HR" }, [rows[3].id, rows[4].id]);
  await expectIds({ mods: "HD" }, [rows[2].id, rows[3].id, rows[4].id]);
  await expectIds({ mods: "NM,HD" }, [rows[1].id]);
  await expectIds({ mods: "DT,HT" }, []);
  await expectIds({}, rows.map(row => row.id));
});

test("search covers five fields, missing metadata, and literal pattern characters", async () => {
  const row = await seed();
  const stored: BountyBeatmapMetadata = {
    url: "https://osu.ppy.sh/beatmaps/123456", version: { id: 123456, name: "UniqueDifficulty" },
    song: { title: "UniqueTitle 100% a_b c\\d", artist: "UniqueArtist" },
    creator: { id: 123, username: "UniqueMapper" }, covers: null,
    specs: { sr: 4, ar: 9, od: 8, cs: 4, hp: 5, bpm: null, length: { total: 120, drain: 110 }, maxCombo: 500 },
    stats: { status: "ranked", playcount: 10 },
  };
  await db.insert(bountyBeatmaps).values({ beatmapId: 123456, metadata: stored });
  const missing = await seed({ creatorOsuUserId: 999, goal: { ...qualifyingBounty().goal, beatmapId: 789 } });
  for (const search of ["uNiQuEtIt", "UniqueArtist", "UniqueDifficulty", "UniqueMapper", "UniqueOwner", "%", "_", "\\"]) {
    await expectIds({ search }, [row.id]);
  }
  await expectIds({ search: "not found" }, []);
  await expectIds({}, [row.id, missing.id]);
});

test("relationships use session identity, avoid duplicates and fall back for anonymous/deleted users", async () => {
  const own = await seed({ creatorOsuUserId: alice.osuUserId });
  const bookmarked = await seed();
  await db.insert(bountyBookmarks).values([
    { bountyId: bookmarked.id, userId: alice.id }, { bountyId: bookmarked.id, userId: bob.id },
    { bountyId: own.id, userId: bob.id },
  ]);
  const cookie = await cookieFor(alice.id);
  await expectIds({ relationship: "created" }, [own.id], cookie);
  await expectIds({ relationship: "bookmarked" }, [bookmarked.id], cookie);
  for (const relationship of ["created", "bookmarked"]) {
    await expectIds({ relationship }, [own.id, bookmarked.id]);
    await expectIds({ relationship }, [own.id, bookmarked.id], await cookieFor(randomUUID()));
  }
});

test("combined filters paginate with stable ties and full count including beyond last page", async () => {
  const rows = [];
  for (let i = 0; i < 25; i++) rows.push(await seed({ createdAt: new Date("2026-01-01Z"), goal: { ...qualifyingBounty().goal, modRequirement: { rule: "exact", mods: ["HD"] } } }));
  await db.insert(bountyBookmarks).values(rows.map(row => ({ bountyId: row.id, userId: alice.id })));
  await seed({ rewardBp: 300 });
  const query = { tiers: "Normal", goals: "full_combo", mods: "HD", search: "owner", relationship: "bookmarked" };
  const cookie = await cookieFor(alice.id);
  const first = await list(query, cookie);
  const second = await list({ ...query, page: "2" }, cookie);
  const third = await list({ ...query, page: "3" }, cookie);
  assert.deepEqual([first.total, second.total, third.total], [25, 25, 25]);
  assert.deepEqual([first.items.length, second.items.length, third.items.length], [20, 5, 0]);
  assert.deepEqual([...first.items, ...second.items].map(row => row.id), rows.map(row => row.id).sort());
  assert.equal(second.page, 2);
  assert.equal(first.pageSize, 20);
});

test("date and reward sorting support both directions", async () => {
  const older = await seed({ rewardBp: 300, createdAt: new Date("2025-01-01Z") });
  const newer = await seed({ rewardBp: 100, createdAt: new Date("2026-01-01Z") });
  for (const [sort, order, expected] of [
    ["date", "asc", [older.id, newer.id]], ["date", "desc", [newer.id, older.id]],
    ["reward", "asc", [newer.id, older.id]], ["reward", "desc", [older.id, newer.id]],
  ] as const) assert.deepEqual((await list({ sort, order })).items.map(row => row.id), expected);
});

test("invalid query parameters return structured 400 responses", async () => {
  for (const query of ["page=0", "page=-1", "page=1.5", "page=abc", "status=draft", "sort=oops", "order=oops", "relationship=oops", "tiers=oops", "goals=oops", "mods=oops", "mods=HD&mods=HR"]) {
    const response = await httpFetch(`${baseUrl}/bounties?${query}`);
    assert.equal(response.status, 400, query);
    assert.equal((await response.json()).code, "INVALID_BOUNTY_LIST_QUERY");
  }
});
