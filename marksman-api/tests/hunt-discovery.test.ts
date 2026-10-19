import assert from "node:assert/strict";
import Module from "node:module";
import { after, afterEach, mock, test } from "node:test";
import { qualifyingScore } from "./fixtures/completion";

type RecordBatch = typeof import("../src/services/bounty-hunts-attempts").recordDiscoveredScores;

// Exercise the real parser while keeping discovery persistence and upstream calls isolated.
const servicePath = require.resolve("../src/services/bounty-hunts-attempts");
const originalModule = require.cache[servicePath];
const service: { recordDiscoveredScores: RecordBatch } = {
  recordDiscoveredScores: async () => [],
};
const stubModule = new Module(servicePath);
stubModule.exports = service;
stubModule.loaded = true;
require.cache[servicePath] = stubModule;
const { processOscScores } = require("../src/services/hunt-discovery") as typeof import("../src/services/hunt-discovery");

afterEach(() => mock.restoreAll());
after(() => {
  if (originalModule) require.cache[servicePath] = originalModule;
  else delete require.cache[servicePath];
});

test("passes parsed evidence in order and separates rejected items from discovery failures", async () => {
  const first = qualifyingScore();
  const second = { ...qualifyingScore(), id: first.id + 1 };
  const { beatmap, beatmapset, ...firstEvidence } = first;
  const secondEvidence = { ...firstEvidence, id: second.id };
  const error = new Error("Score persistence failed");
  const failures = [{ scoreId: second.id, error }];
  const record = mock.method(service, "recordDiscoveredScores", async () => failures);
  const payload = [first, null, { ...first, accuracy: 99 }, second];
  const original = structuredClone(payload);

  assert.deepEqual(await processOscScores(payload), { rejectedCount: 2, failures });
  assert.deepEqual(record.mock.calls.map(call => call.arguments), [[
    [firstEvidence, secondEvidence],
  ]]);
  assert.deepEqual(payload, original);
});

for (const [label, payload, rejectedCount] of [
  ["empty", [], 0],
  ["entirely malformed", [null, {}, false], 3],
] as const) {
  test(`${label} batch returns its rejection count with no discovery failures`, async () => {
    const record = mock.method(service, "recordDiscoveredScores");
    assert.deepEqual(await processOscScores(payload), { rejectedCount, failures: [] });
    assert.deepEqual(record.mock.calls.map(call => call.arguments), [[[]]]);
  });
}

test("invalid top-level payload rejects without invoking discovery", async () => {
  const record = mock.method(service, "recordDiscoveredScores");
  await assert.rejects(processOscScores({ scores: [] }), /Unexpected payload shape/);
  assert.equal(record.mock.callCount(), 0);
});

test("propagates a rejected discovery batch unchanged", async () => {
  const error = new Error("Pair lookup failed");
  const record = mock.method(service, "recordDiscoveredScores", async () => { throw error; });
  await assert.rejects(processOscScores([qualifyingScore()]), (caught: unknown) => caught === error);
  assert.equal(record.mock.callCount(), 1);
});

test("waits for discovery before returning its result", async () => {
  let resolve!: (value: Awaited<ReturnType<RecordBatch>>) => void;
  const pending = new Promise<Awaited<ReturnType<RecordBatch>>>(done => { resolve = done; });
  mock.method(service, "recordDiscoveredScores", () => pending);
  let finished = false;
  const result = processOscScores([qualifyingScore()]).then(value => {
    finished = true;
    return value;
  });
  try {
    await new Promise<void>(done => setImmediate(done));
    assert.equal(finished, false);
  } finally { resolve([]); }
  assert.deepEqual(await result, { rejectedCount: 0, failures: [] });
});
