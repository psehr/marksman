import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { contributeToBounty } from "../../src/lib/api/bounties";
import { ApiError } from "../../src/lib/api/client";

const bountyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { amountBp: 11, idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
const contribution = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", bountyId,
  userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", amountBp: 11, feeBp: 2,
  createdAt: "2026-11-17T12:00:00.000Z",
};
afterEach(() => mock.restoreAll());

test("posts validated contribution with credentials and validates response", async () => {
  const transport = mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    assert.ok(String(url).endsWith(`/bounties/${bountyId}/contributions`));
    assert.equal(options?.method, "POST");
    assert.equal(options?.credentials, "include");
    assert.deepEqual(JSON.parse(String(options?.body)), input);
    return Response.json(contribution);
  });
  assert.deepEqual(await contributeToBounty(bountyId, input), contribution);
  assert.equal(transport.mock.callCount(), 1);
});

test("invalid input is rejected before transport", async () => {
  const transport = mock.method(globalThis, "fetch", async () => Response.json(contribution));
  for (const invalid of [{ ...input, amountBp: 0 }, { ...input, amountBp: 1.5 }, { ...input, idempotencyKey: "invalid" }]) {
    await assert.rejects(contributeToBounty(bountyId, invalid));
  }
  assert.equal(transport.mock.callCount(), 0);
});

test("rejects malformed successful payload", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ ...contribution, amountBp: -1 }));
  await assert.rejects(contributeToBounty(bountyId, input));
});

test("preserves service conflict code and message", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ code: "BOUNTY_REWARD_LIMIT", error: "Reward limit reached" }, { status: 409 }));
  await assert.rejects(contributeToBounty(bountyId, input), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "BOUNTY_REWARD_LIMIT");
    assert.equal(error.message, "Reward limit reached");
    return true;
  });
});
