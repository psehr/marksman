import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_BOUNTY_REWARD_BP, bountyContributionRequestSchema, createBountySchema } from "@marksman/contracts";

const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

for (const amount of [1, MAX_BOUNTY_REWARD_BP]) {
  test(`creation and contribution accept ${amount} BP`, () => {
    assert.ok(bountyContributionRequestSchema.safeParse({ amountBp: amount, idempotencyKey: key }).success);
    assert.ok(createBountySchema.safeParse({ rewardBp: amount, goal: { type: "pass", beatmapId: 123 } }).success);
  });
}
for (const amount of [0, -1, 1.5, "100", true, MAX_BOUNTY_REWARD_BP + 1, Infinity, NaN]) {
  test(`creation and contribution reject invalid amount ${String(amount)}`, () => {
    assert.equal(bountyContributionRequestSchema.safeParse({ amountBp: amount, idempotencyKey: key }).success, false);
    assert.equal(createBountySchema.safeParse({ rewardBp: amount, goal: { type: "pass", beatmapId: 123 } }).success, false);
  });
}
for (const idempotencyKey of [undefined, null, "", "not-a-uuid", 123]) {
  test(`contribution rejects invalid idempotency key ${String(idempotencyKey)}`, () => {
    assert.equal(bountyContributionRequestSchema.safeParse({ amountBp: 10, idempotencyKey }).success, false);
  });
}
test("request ignores client-supplied identity, fee and timestamp", () => {
  assert.deepEqual(bountyContributionRequestSchema.parse({
    amountBp: 10, idempotencyKey: key, userId: key, bountyId: key, feeBp: 0, createdAt: "forged",
  }), { amountBp: 10, idempotencyKey: key });
});
