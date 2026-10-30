import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getBounties, getBookmarkedBounties } from "../../src/lib/api/bounties";

const page = { items: [], total: 25, page: 3, pageSize: 20 };
afterEach(() => mock.restoreAll());

test("serializes typed filters and preserves pagination metadata", async () => {
  const transport = mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    assert.equal(params.get("search"), "title & artist + 100%");
    assert.equal(params.get("tiers"), "Normal,Hard");
    assert.equal(params.get("goals"), "full_combo,minimum_grade");
    assert.equal(params.get("mods"), "HD,HR");
    assert.equal(params.get("page"), "3");
    assert.equal(params.get("status"), "completed");
    assert.equal(params.get("relationship"), "created");
    assert.equal(params.get("sort"), "reward");
    assert.equal(params.get("order"), "asc");
    assert.equal(init?.credentials, "include");
    return Response.json(page);
  });
  assert.deepEqual(await getBounties({ search: "title & artist + 100%", tiers: ["Normal", "Hard"], goals: ["full_combo", "minimum_grade"], mods: ["HD", "HR"], page: 3, status: "completed", relationship: "created", sort: "reward", order: "asc" }), page);
  assert.equal(transport.mock.callCount(), 1);
});

test("omitted options request the default list", async () => {
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    assert.ok(String(input).endsWith("/bounties"));
    return Response.json(page);
  });
  assert.deepEqual(await getBounties(), page);
});

test("rejects legacy arrays and invalid pagination or items", async () => {
  for (const payload of [[], { ...page, total: -1 }, { ...page, page: 0 }, { ...page, items: [{}] }]) {
    const transport = mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(getBounties());
    transport.mock.restore();
  }
});

test("bookmark endpoint retains its array response", async () => {
  mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
    assert.ok(String(input).endsWith("/users/me/bookmarked-bounties"));
    return Response.json([]);
  });
  assert.deepEqual(await getBookmarkedBounties(), []);
});
