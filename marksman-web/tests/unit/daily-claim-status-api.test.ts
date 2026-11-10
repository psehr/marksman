import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getDailyClaimStatus } from "../../src/lib/api/economy";
import { ApiError } from "../../src/lib/api/client";

afterEach(() => mock.restoreAll());
test("daily status validates both response branches with credentialed uncached GET", async () => {
  for (const payload of [{ claimedToday: false }, { claimedToday: true, nextClaimAt: "2026-11-11T00:00:00.000Z" }]) {
    const transport = mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      assert.equal(url, `${process.env.NEXT_PUBLIC_API_URL}/economy/daily-claim`);
      assert.equal(options?.method, "GET");
      assert.equal(options?.credentials, "include");
      assert.equal(options?.cache, "no-store");
      return Response.json(payload);
    });
    assert.deepEqual(await getDailyClaimStatus(), payload);
    transport.mock.restore();
  }
});
test("daily status rejects missing flag, missing timestamp and invalid timestamp", async () => {
  for (const payload of [{}, { claimedToday: true }, { claimedToday: true, nextClaimAt: "tomorrow" }, { claimedToday: "false" }]) {
    const transport = mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(getDailyClaimStatus());
    transport.mock.restore();
  }
});
test("daily status propagates API errors for retry handling", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ code: "NOT_LOGGED_IN" }, { status: 401 }));
  await assert.rejects(getDailyClaimStatus(), error => error instanceof ApiError && error.status === 401);
});
