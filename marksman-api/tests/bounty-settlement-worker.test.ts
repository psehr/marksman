import assert from "node:assert/strict";
import Module from "node:module";
import { after, afterEach, beforeEach, mock, test } from "node:test";

type BatchResult = Awaited<ReturnType<typeof import("../src/services/bounty-settlements").settleDueBounties>>;

// Stub before loading the worker so no database or upstream modules are loaded.
const servicePath = require.resolve("../src/services/bounty-settlements");
const originalModule = require.cache[servicePath];
const service = { settleDueBounties: async (_limit: number): Promise<BatchResult> => [] };
const stubModule = new Module(servicePath);
stubModule.exports = service;
stubModule.loaded = true;
require.cache[servicePath] = stubModule;
const healthPath = require.resolve("../src/services/hunt-discovery");
const originalHealth = require.cache[healthPath];
let healthy = true;
const healthStub = new Module(healthPath);
healthStub.exports = { isDiscoveryHealthy: () => healthy };
healthStub.loaded = true;
require.cache[healthPath] = healthStub;
const { startBountySettlementWorker } = require("../src/workers/bounty-settlement") as typeof import("../src/workers/bounty-settlement");

let stop: (() => Promise<void>) | undefined;

function deferredBatch() {
  let resolve!: (value: BatchResult) => void;
  const promise = new Promise<BatchResult>((done) => { resolve = done; });
  return { promise, resolve };
}

// Allow promise continuations to finish without advancing the fake timer.
async function flush() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  healthy = true;
  mock.timers.enable({ apis: ["setTimeout"] });
});

afterEach(async () => {
  await stop?.();
  stop = undefined;
  mock.timers.reset();
  mock.restoreAll();
});

after(() => {
  if (originalHealth) require.cache[healthPath] = originalHealth;
  else delete require.cache[healthPath];
  if (originalModule) require.cache[servicePath] = originalModule;
  else delete require.cache[servicePath];
});

test("starts immediately with 20 attempts and repeats after a full one-second pause", async () => {
  const batch = mock.method(service, "settleDueBounties");
  stop = startBountySettlementWorker();
  assert.equal(typeof stop, "function");
  assert.deepEqual(batch.mock.calls.map(call => call.arguments), [[20]]);
  await flush();
  mock.timers.tick(999);
  assert.equal(batch.mock.callCount(), 1);
  mock.timers.tick(1);
  assert.equal(batch.mock.callCount(), 2);
  await flush();
  mock.timers.tick(1000);
  assert.equal(batch.mock.callCount(), 3);
});

test("does not overlap a slow batch and measures the pause from completion", async () => {
  const pending = deferredBatch();
  const batch = mock.method(service, "settleDueBounties", () => pending.promise);
  stop = startBountySettlementWorker();
  try {
    mock.timers.tick(10_000);
    await flush();
    assert.equal(batch.mock.callCount(), 1);
  } finally {
    pending.resolve([]);
  }
  await flush();
  mock.timers.tick(999);
  assert.equal(batch.mock.callCount(), 1);
  mock.timers.tick(1);
  assert.equal(batch.mock.callCount(), 2);
});

test("stop cancels a waiting timer and can be called repeatedly", async () => {
  const batch = mock.method(service, "settleDueBounties");
  stop = startBountySettlementWorker();
  await flush();
  await stop();
  await stop();
  mock.timers.tick(10_000);
  await flush();
  assert.equal(batch.mock.callCount(), 1);
});

test("stop waits for an active batch and prevents rescheduling", async () => {
  const pending = deferredBatch();
  const batch = mock.method(service, "settleDueBounties", () => pending.promise);
  stop = startBountySettlementWorker();
  let finished = false;
  const stopping = stop().then(() => { finished = true; });
  const stoppingAgain = stop();
  try {
    await flush();
    assert.equal(finished, false);
    mock.timers.tick(10_000);
    assert.equal(batch.mock.callCount(), 1);
  } finally {
    pending.resolve([]);
  }
  await Promise.all([stopping, stoppingAgain]);
  assert.equal(finished, true);
  mock.timers.tick(10_000);
  await flush();
  assert.equal(batch.mock.callCount(), 1);
});

test("logs individual failures and continues with the next batch", async () => {
  const failures = [
    { bountyId: "attempt-a", error: new Error("first failure") },
    { bountyId: "attempt-b", error: new Error("second failure") },
  ];
  const batch = mock.method(service, "settleDueBounties", async () => failures);
  const warnings = mock.method(console, "warn", () => {});
  stop = startBountySettlementWorker();
  await flush();
  assert.equal(warnings.mock.callCount(), 2);
  for (const [index, failure] of failures.entries()) {
    const line = String(warnings.mock.calls[index].arguments[0]);
    assert.match(line, /\[WARN\] \[bounty-settlement\] attempt_failed/);
    assert.ok(line.includes(failure.bountyId));
    assert.ok(line.includes(failure.error.message));
  }
  mock.timers.tick(1000);
  assert.equal(batch.mock.callCount(), 2);
});

test("logs a rejected batch and recovers on the next cycle", async () => {
  let calls = 0;
  const batch = mock.method(service, "settleDueBounties", async () => {
    if (++calls === 1) throw new Error("query unavailable");
    return [];
  });
  const errors = mock.method(console, "error", () => {});
  stop = startBountySettlementWorker();
  await flush();
  assert.equal(errors.mock.callCount(), 1);
  assert.match(String(errors.mock.calls[0].arguments[0]), /\[ERROR\] \[bounty-settlement\] batch_failed.*query unavailable/);
  mock.timers.tick(1000);
  await flush();
  assert.equal(batch.mock.callCount(), 2);
  assert.equal(errors.mock.callCount(), 1);
});

for (const initiallyHealthy of [false, true]) {
  test(`resumes after discovery recovery (initial health: ${initiallyHealthy})`, async () => {
    healthy = initiallyHealthy;
    const batch = mock.method(service, "settleDueBounties");
    stop = startBountySettlementWorker();
    await flush();
    const initialCalls = initiallyHealthy ? 1 : 0;
    assert.equal(batch.mock.callCount(), initialCalls);
    healthy = false;
    mock.timers.tick(1000);
    await flush();
    assert.equal(batch.mock.callCount(), initialCalls);
    healthy = true;
    mock.timers.tick(1000);
    await flush();
    assert.equal(batch.mock.callCount(), initialCalls + 1);
  });
}
