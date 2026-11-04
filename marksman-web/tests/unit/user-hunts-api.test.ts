import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getUserHunts } from "../../src/lib/api/users";
import { ApiError } from "../../src/lib/api/client";

const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pair = {
  hunt: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", userId,
    bountyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    startedAt: "2026-11-04T10:00:00.000Z", endedAt: null, status: "ongoing",
  },
  bounty: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    creatorOsuUserId: 42, rewardBp: 100, status: "open",
    createdAt: "2026-11-04T09:00:00.000Z",
    completedByOsuUserId: null, completionScoreId: null, completedAt: null, cancelledAt: null,
    goal: { type: "full_combo", beatmapId: 123, beatmapChecksum: null, minimumComboRatio: 0.99,
      modRequirement: { rule: "any" } },
    beatmap: null, owner: null, winner: null,
    engagement: { bookmarkCount: 0, isBookmarkedByCurrentUser: null },
  },
};

afterEach(() => mock.restoreAll());

test("profile hunts validates enriched pairs and forwards request credentials and signal", async () => {
  const controller = new AbortController();
  mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    assert.equal(url, `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/hunts`);
    assert.equal(options?.credentials, "include");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.signal, controller.signal);
    return Response.json([pair]);
  });
  assert.deepEqual(await getUserHunts(userId, controller.signal), [pair]);
});

test("profile hunts accepts no ongoing hunts and encodes the profile ID", async () => {
  mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0]) => {
    assert.equal(url, `${process.env.NEXT_PUBLIC_API_URL}/users/a%2Fb%3F/hunts`);
    return Response.json([]);
  });
  assert.deepEqual(await getUserHunts("a/b?"), []);
});

test("profile hunts rejects plain hunts and incomplete bounty data", async () => {
  for (const payload of [[pair.hunt], [{ ...pair, bounty: {} }], {}]) {
    const transport = mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(getUserHunts(userId));
    transport.mock.restore();
  }
});

test("profile hunts preserves missing-user errors and request failures", async () => {
  const transport = mock.method(globalThis, "fetch", async () => Response.json({
    code: "USER_NOT_FOUND", error: "User not found",
  }, { status: 404 }));
  await assert.rejects(getUserHunts(userId), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, "USER_NOT_FOUND");
    return true;
  });
  transport.mock.restore();
  for (const failure of [new TypeError("Network failed"), new DOMException("Aborted", "AbortError")]) {
    const failed = mock.method(globalThis, "fetch", async () => { throw failure; });
    await assert.rejects(getUserHunts(userId), (error: unknown) => error === failure);
    failed.mock.restore();
  }
});
