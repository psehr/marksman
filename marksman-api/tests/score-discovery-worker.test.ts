import assert from "node:assert/strict";
import Module from "node:module";
import { after, afterEach, beforeEach, mock, test } from "node:test";

const servicePath = require.resolve("../src/services/hunt-discovery");
const original = require.cache[servicePath];
const service = { discoverScores: async (): Promise<void> => {} };
const stub = new Module(servicePath);
stub.exports = service;
stub.loaded = true;
require.cache[servicePath] = stub;
const { startScoreDiscoveryWorker } = require("../src/workers/score-discovery") as typeof import("../src/workers/score-discovery");
let stop: (() => Promise<void>) | undefined;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { mock.timers.enable({ apis: ["setTimeout"] }); });
afterEach(async () => {
  try { await stop?.(); }
  finally { stop = undefined; mock.timers.reset(); mock.restoreAll(); }
});
after(() => {
  if (original) require.cache[servicePath] = original;
  else delete require.cache[servicePath];
});

test("returns the stop function synchronously, like the verification worker", async () => {
  const result = startScoreDiscoveryWorker();
  stop = await result;
  assert.equal(typeof result, "function");
});

test("starts immediately and repeats after a full ten-second pause", async () => {
  const discover = mock.method(service, "discoverScores");
  stop = await startScoreDiscoveryWorker();
  assert.equal(discover.mock.callCount(), 1);
  await flush();
  mock.timers.tick(9_999);
  assert.equal(discover.mock.callCount(), 1);
  mock.timers.tick(1);
  assert.equal(discover.mock.callCount(), 2);
  await flush();
  mock.timers.tick(10_000);
  assert.equal(discover.mock.callCount(), 3);
});

test("slow discovery never overlaps and the pause starts after completion", async () => {
  const pending = deferred();
  const discover = mock.method(service, "discoverScores", () => pending.promise);
  stop = await startScoreDiscoveryWorker();
  try {
    mock.timers.tick(60_000);
    await flush();
    assert.equal(discover.mock.callCount(), 1);
  } finally { pending.resolve(); }
  await flush();
  mock.timers.tick(9_999);
  assert.equal(discover.mock.callCount(), 1);
  mock.timers.tick(1);
  assert.equal(discover.mock.callCount(), 2);
});

test("stop cancels the timer and is repeatable", async () => {
  const discover = mock.method(service, "discoverScores");
  stop = await startScoreDiscoveryWorker();
  await flush();
  await stop(); await stop();
  mock.timers.tick(60_000);
  await flush();
  assert.equal(discover.mock.callCount(), 1);
});

test("stop drains active discovery without scheduling again", async () => {
  const pending = deferred();
  const discover = mock.method(service, "discoverScores", () => pending.promise);
  stop = await startScoreDiscoveryWorker();
  let finished = false;
  const stopping = stop().then(() => { finished = true; });
  try {
    await flush();
    assert.equal(finished, false);
    mock.timers.tick(60_000);
    assert.equal(discover.mock.callCount(), 1);
  } finally { pending.resolve(); await stopping; }
  mock.timers.tick(60_000);
  await flush();
  assert.equal(discover.mock.callCount(), 1);
});

test("discovery failure is logged and does not make shutdown reject", async () => {
  mock.method(service, "discoverScores", async () => { throw new Error("Upstream unavailable"); });
  const errors = mock.method(console, "error", () => {});
  const stopping = await startScoreDiscoveryWorker();
  // Attach immediately so the regression is reported as an assertion, not an unhandled rejection.
  await assert.doesNotReject(stopping());
  assert.equal(errors.mock.callCount(), 1);
  assert.match(String(errors.mock.calls[0].arguments[0]), /Upstream unavailable/);
});

for (const synchronous of [false, true]) {
  test(`logs a ${synchronous ? "synchronous throw" : "rejected cycle"} and recovers after ten seconds`, async () => {
    let calls = 0;
    const discover = mock.method(service, "discoverScores", () => {
      if (++calls === 1) {
        const error = new Error("Temporary discovery failure");
        if (synchronous) throw error;
        return Promise.reject(error);
      }
      return Promise.resolve();
    });
    const errors = mock.method(console, "error", () => {});
    stop = await startScoreDiscoveryWorker();
    await flush();
    assert.equal(errors.mock.callCount(), 1);
    assert.match(String(errors.mock.calls[0].arguments[0]), /\[ERROR\] \[osu-scores-discovery\].*Temporary discovery failure/);
    mock.timers.tick(9_999);
    assert.equal(discover.mock.callCount(), 1);
    mock.timers.tick(1);
    await flush();
    assert.equal(discover.mock.callCount(), 2);
    assert.equal(errors.mock.callCount(), 1);
  });
}
