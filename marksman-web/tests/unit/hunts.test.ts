import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError } from "../../src/lib/api/client";
import { getOngoingHunts, startHunt, stopHunt } from "../../src/lib/api/hunts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const hunt = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  bountyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  startedAt: "2026-10-24T10:00:00.000Z",
  endedAt: null,
  status: "ongoing",
};

test("ongoing hunts use session credentials, no cache and the cancellation signal", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${process.env.NEXT_PUBLIC_API_URL}/users/me/hunts`);
    assert.equal(options?.credentials, "include");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.signal, controller.signal);
    return Response.json([hunt]);
  };
  assert.deepEqual(await getOngoingHunts(controller.signal), [hunt]);
});

test("an empty ongoing list is valid", async () => {
  globalThis.fetch = async () => Response.json([]);
  assert.deepEqual(await getOngoingHunts(), []);
});

test("start and stop POST to their respective resources without supplying an identity", async () => {
  const stopped = { ...hunt, status: "stopped", endedAt: "2026-10-24T10:05:00.000Z" };
  const requests: string[] = [];
  globalThis.fetch = async (url, options) => {
    requests.push(String(url));
    assert.equal(options?.method, "POST");
    assert.equal(options?.credentials, "include");
    assert.equal(options?.body, undefined);
    return Response.json(requests.length === 1 ? hunt : stopped);
  };
  assert.deepEqual(await startHunt(hunt.bountyId), hunt);
  assert.deepEqual(await stopHunt(hunt.id), stopped);
  assert.deepEqual(requests, [
    `${process.env.NEXT_PUBLIC_API_URL}/bounties/${hunt.bountyId}/hunt`,
    `${process.env.NEXT_PUBLIC_API_URL}/hunts/${hunt.id}/stop`,
  ]);
});

test("API errors preserve status, code and user-facing explanation", async () => {
  globalThis.fetch = async () => Response.json({
    code: "HUNT_SLOTS_FULL", error: "Your hunting slots are full",
  }, { status: 409 });
  await assert.rejects(startHunt(hunt.bountyId), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "HUNT_SLOTS_FULL");
    assert.equal(error.message, "Your hunting slots are full");
    return true;
  });
});

test("non-JSON server errors produce a safe fallback", async () => {
  globalThis.fetch = async () => new Response("<html>Bad gateway</html>", { status: 502 });
  await assert.rejects(getOngoingHunts(), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.message, "Request failed. Please try again.");
    return true;
  });
});

test("malformed successful data is rejected before reaching UI state", async () => {
  globalThis.fetch = async () => Response.json([{ ...hunt, id: "invalid" }]);
  await assert.rejects(getOngoingHunts());
  globalThis.fetch = async () => Response.json({ ...hunt, status: "invalid" });
  await assert.rejects(startHunt(hunt.bountyId));
});

test("network failures and aborts propagate", async () => {
  for (const failure of [new TypeError("Network failed"), new DOMException("Aborted", "AbortError")]) {
    globalThis.fetch = async () => { throw failure; };
    await assert.rejects(getOngoingHunts(), (error: unknown) => error === failure);
  }
});
