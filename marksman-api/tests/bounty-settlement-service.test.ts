import assert from "node:assert/strict";
import Module from "node:module";
import { after, mock, test } from "node:test";
import { HuntNotFoundError, UserNotFoundError } from "../src/services/errors";

const tx = {};
let status = "open";
let settlement: { settledAt: Date | null; settleAfter: Date; nextAttemptAt: Date } | undefined;
let leaderReads = 0;
let huntExists = true;
let userExists = true;
const writes: { name: string; args: unknown[] }[] = [];
let failAt = "";
function write(name: string, connection: unknown, args: unknown[]) {
  assert.equal(connection, tx);
  writes.push({ name, args });
  if (failAt === name) throw new Error(`failed ${name}`);
}
const completedAt = "2026-10-22T12:00:00.000Z";
const originals = new Map<string, NodeModule | undefined>();
for (const [path, exports] of [
  ["../src/db/bounty-hunts", {
    findHuntById: async (connection: unknown) => { assert.equal(connection, tx); return huntExists ? { userId: "winner" } : undefined; },
    closeOngoingHuntsForBounty: async (connection: unknown, ...args: unknown[]) => write("close", connection, args),
  }],
  ["../src/db/users", {
    findUserByIdForUpdate: async (connection: unknown) => { assert.equal(connection, tx); return userExists ? { identity: { osuUserId: 123 } } : undefined; },
    creditUserBp: async (connection: unknown, ...args: unknown[]) => { write("credit", connection, args); return { ok: true, userId: "winner" }; },
  }],
  ["../src/db/ledger", { createBountyRewardLedgerEntry: async (connection: unknown, ...args: unknown[]) => write("ledger", connection, args) }],
  ["../src/db", { db: { transaction: async (fn: (connection: unknown) => Promise<unknown>) => fn(tx) } }],
  ["../src/db/bounties", { findBountyByIdForUpdate: async (connection: unknown) => {
    assert.equal(connection, tx);
    return { status };
  }, markOpenBountyCompleted: async (connection: unknown, ...args: unknown[]) => {
    write("complete", connection, args);
    return { id: "bounty", rewardBp: 100, completedAt };
  } }],
  ["../src/db/bounty-settlements", { findBountySettlementByBountyId: async (connection: unknown) => {
    assert.equal(connection, tx);
    return settlement;
  }, completeSettlementByBountyId: async (connection: unknown, ...args: unknown[]) => write("settle", connection, args) }],
  ["../src/db/bounty-hunts-attempts", { findLeadingHuntAttempt: async (connection: unknown) => {
    assert.equal(connection, tx);
    leaderReads++;
    return undefined;
  } }],
] as const) {
  const id = require.resolve(path);
  originals.set(id, require.cache[id]);
  const stub = new Module(id);
  stub.exports = exports;
  stub.loaded = true;
  require.cache[id] = stub;
}
const { settleBounty, payoutBounty } = require("../src/services/bounty-settlements") as typeof import("../src/services/bounty-settlements");
test("transaction rejection schedules a five-minute retry after rollback and propagates the error", async () => {
  const { db } = require("../src/db");
  const helpers = require("../src/db/bounty-settlements");
  const failure = new Error("transaction failed");
  const events: string[] = [];
  const transaction = mock.method(db, "transaction", async () => {
    await Promise.resolve();
    events.push("rollback");
    throw failure;
  });
  const calls: unknown[][] = [];
  helpers.scheduleSettlementRetry = async (...args: unknown[]) => {
    events.push("retry");
    calls.push(args);
  };
  const started = Date.now();
  try {
    await assert.rejects(settleBounty("bounty"), error => error === failure);
    assert.deepEqual(events, ["rollback", "retry"]);
    assert.equal(calls[0][0], db);
    assert.equal(calls[0][1], "bounty");
    assert.ok((calls[0][2] as Date).getTime() >= started + 300000);
    assert.ok((calls[0][2] as Date).getTime() <= Date.now() + 300000);
    assert.notEqual(calls[0][3], "PENDING_LEADER");
  } finally {
    transaction.mock.restore();
    delete helpers.scheduleSettlementRetry;
  }
});
after(() => {
  for (const [id, original] of originals) {
    if (original) require.cache[id] = original;
    else delete require.cache[id];
  }
});

for (const scenario of ["missing", "closed", "settled", "window pending", "retry pending", "ready"] as const) {
  test(`settlement readiness: ${scenario}`, async () => {
    status = scenario === "closed" ? "cancelled" : "open";
    leaderReads = 0;
    const past = new Date(0);
    const future = new Date("2100-01-01T00:00:00Z");
    settlement = scenario === "missing" ? undefined : {
      settledAt: scenario === "settled" ? past : null,
      settleAfter: scenario === "window pending" ? future : past,
      nextAttemptAt: scenario === "retry pending" ? future : past,
    };
    await settleBounty("00000000-0000-4000-8000-000000000001");
    assert.equal(leaderReads, scenario === "ready" ? 1 : 0);
  });
}

for (const missing of ["hunt", "user"] as const) {
  test(`payout reports a missing ${missing} instead of silently succeeding`, async () => {
    huntExists = missing !== "hunt";
    userExists = missing !== "user";
    await assert.rejects(() => payoutBounty(
      tx as Parameters<typeof payoutBounty>[0],
      { id: "bounty" } as Parameters<typeof payoutBounty>[1],
      { huntId: "hunt" } as Parameters<typeof payoutBounty>[2],
      new Date(),
    ), missing === "hunt" ? HuntNotFoundError : UserNotFoundError);
  });
}

for (const failure of ["", "credit", "ledger", "close", "settle"]) {
  test(`payout ${failure ? `propagates ${failure} failure` : "writes reward, history, closure and settlement using the supplied transaction"}`, async () => {
    huntExists = userExists = true;
    writes.length = 0;
    failAt = failure;
    const now = new Date(completedAt);
    const run = () => payoutBounty(
      tx as Parameters<typeof payoutBounty>[0],
      { id: "bounty", rewardBp: 999 } as Parameters<typeof payoutBounty>[1],
      { huntId: "hunt", scoreId: 456 } as Parameters<typeof payoutBounty>[2],
      now,
    );
    if (failure) {
      await assert.rejects(run, new RegExp(`failed ${failure}`));
      assert.equal(writes.at(-1)?.name, failure);
    } else {
      await run();
      assert.deepEqual(writes, [
        { name: "complete", args: ["bounty", 123, 456] },
        { name: "credit", args: [123, 100] },
        { name: "ledger", args: ["bounty", "winner", 100] },
        { name: "close", args: ["bounty", new Date(completedAt)] },
        { name: "settle", args: ["bounty", now] },
      ]);
    }
  });
}
