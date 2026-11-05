import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getCurrentUser, getUser } from "../../src/lib/api/users";

const user = {
  identity: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", osuUserId: 42, username: "fixture" },
  stats: { bpBalance: 123 }, createdAt: "2026-01-01T00:00:00.000Z",
};
afterEach(() => mock.restoreAll());

test("profile fetch preserves detailed win stats including zero", async () => {
  for (const stats of [
    { bpBalance: 123, bountiesWon: 0, bountyEarningsBp: 0 },
    { bpBalance: 123, bountiesWon: 2, bountyEarningsBp: 200 },
  ]) {
    const detailed = { ...user, stats };
    const transport = mock.method(globalThis, "fetch", async () => Response.json(detailed));
    assert.deepEqual(await getUser(user.identity.id), detailed);
    transport.mock.restore();
  }
});

test("profile fetch rejects missing and malformed detailed stats", async () => {
  for (const stats of [user.stats,
    { ...user.stats, bountiesWon: -1, bountyEarningsBp: 200 },
    { ...user.stats, bountiesWon: 2, bountyEarningsBp: 1.5 },
    { ...user.stats, bountiesWon: "2", bountyEarningsBp: 200 },
  ]) {
    const transport = mock.method(globalThis, "fetch", async () => Response.json({ ...user, stats }));
    await assert.rejects(getUser(user.identity.id));
    transport.mock.restore();
  }
});

test("current account fetch still accepts base User without profile stats", async () => {
  mock.method(globalThis, "fetch", async () => Response.json(user));
  assert.deepEqual(await getCurrentUser(), user);
});
