import assert from "node:assert/strict";
import Module from "node:module";
import { after, afterEach, beforeEach, mock, test } from "node:test";
import { qualifyingScore } from "./fixtures/completion";

type RecordBatch =
  typeof import("../src/services/bounty-hunts-attempts").recordDiscoveredScores;

// Keep the real parser; stub all I/O before importing the discovery service.
const service: { recordDiscoveredScores: RecordBatch } = {
  recordDiscoveredScores: async () => [],
};
const db = {};
const cursors = {
  findCursorByStream: async (_connection: unknown, _stream: string): Promise<string | undefined> => "saved",
  upsertCursor: async (_connection: unknown, _stream: string, _cursor: string): Promise<void> => {},
};
const upstream = {
  fetchScoresBatch: async (_cursor?: string): Promise<{ scores: unknown[]; cursor_string: string }> => ({
    scores: [qualifyingScore()], cursor_string: "next",
  }),
};
const originals = new Map<string, NodeModule | undefined>();
for (const [path, exports] of [
  ["../src/services/bounty-hunts-attempts", service],
  ["../src/db", { db }],
  ["../src/db/score-discovery-cursors", cursors],
  ["../src/integrations/osu/scores", upstream],
] as const) {
  const id = require.resolve(path);
  originals.set(id, require.cache[id]);
  const stub = new Module(id);
  stub.exports = exports;
  stub.loaded = true;
  require.cache[id] = stub;
}
const { processDiscoveredScores, discoverScores, isDiscoveryHealthy } =
  require("../src/services/hunt-discovery") as typeof import("../src/services/hunt-discovery");

beforeEach(() => {
  mock.method(globalThis, "fetch", async () => { throw new Error("Live network disabled"); });
});
afterEach(() => mock.restoreAll());
after(() => {
  for (const [id, original] of originals) {
    if (original) require.cache[id] = original;
    else delete require.cache[id];
  }
});

test("discovery starts unhealthy and becomes healthy only after saving its cursor", async () => {
  assert.equal(isDiscoveryHealthy(), false);
  const save = mock.method(cursors, "upsertCursor", async () => {
    assert.equal(isDiscoveryHealthy(), false);
  });
  await discoverScores();
  assert.equal(save.mock.callCount(), 1);
  assert.equal(isDiscoveryHealthy(), true);
});

for (const stage of ["cursor read", "fetch", "processing", "cursor save"] as const) {
  test(`discovery becomes unhealthy after ${stage} throws and recovers on success`, async () => {
    await discoverScores();
    assert.equal(isDiscoveryHealthy(), true);
    const failure = new Error(stage);
    const reject = async (): Promise<never> => { throw failure; };
    const stub = stage === "cursor read" ? mock.method(cursors, "findCursorByStream", reject)
      : stage === "fetch" ? mock.method(upstream, "fetchScoresBatch", reject)
      : stage === "processing" ? mock.method(service, "recordDiscoveredScores", reject)
      : mock.method(cursors, "upsertCursor", reject);
    await assert.rejects(discoverScores(), error => error === failure);
    assert.equal(isDiscoveryHealthy(), false);
    stub.mock.restore();
    await discoverScores();
    assert.equal(isDiscoveryHealthy(), true);
  });
}

test("a running successful poll retains the preceding healthy status", async () => {
  await discoverScores();
  mock.method(upstream, "fetchScoresBatch", async () => {
    assert.equal(isDiscoveryHealthy(), true);
    return { scores: [], cursor_string: "next" };
  });
  mock.method(cursors, "upsertCursor", async () => {
    assert.equal(isDiscoveryHealthy(), true);
  });
  await discoverScores();
  assert.equal(isDiscoveryHealthy(), true);
});

test("passes parsed evidence in order and separates rejected items from discovery failures", async () => {
  const first = qualifyingScore();
  const second = { ...qualifyingScore(), id: first.id + 1 };
  const { beatmap, beatmapset, ...firstEvidence } = first;
  const secondEvidence = { ...firstEvidence, id: second.id };
  const error = new Error("Score persistence failed");
  const failures = [{ scoreId: second.id, error }];
  const record = mock.method(
    service,
    "recordDiscoveredScores",
    async () => failures,
  );
  const payload = [first, null, { ...first, accuracy: 99 }, second];
  const original = structuredClone(payload);

  assert.deepEqual(await processDiscoveredScores(payload), {
    rejectedCount: 2,
    failures,
  });
  assert.deepEqual(
    record.mock.calls.map((call) => call.arguments),
    [[[firstEvidence, secondEvidence]]],
  );
  assert.deepEqual(payload, original);
});

for (const [label, payload, rejectedCount] of [
  ["empty", [], 0],
  ["entirely malformed", [null, {}, false], 3],
] as const) {
  test(`${label} batch returns its rejection count with no discovery failures`, async () => {
    const record = mock.method(service, "recordDiscoveredScores");
    assert.deepEqual(await processDiscoveredScores(payload), {
      rejectedCount,
      failures: [],
    });
    assert.deepEqual(
      record.mock.calls.map((call) => call.arguments),
      [[[]]],
    );
  });
}

test("invalid top-level payload rejects without invoking discovery", async () => {
  const record = mock.method(service, "recordDiscoveredScores");
  await assert.rejects(
    processDiscoveredScores({ scores: [] }),
    /Unexpected payload shape/,
  );
  assert.equal(record.mock.callCount(), 0);
});

test("propagates a rejected discovery batch unchanged", async () => {
  const error = new Error("Pair lookup failed");
  const record = mock.method(service, "recordDiscoveredScores", async () => {
    throw error;
  });
  await assert.rejects(
    processDiscoveredScores([qualifyingScore()]),
    (caught: unknown) => caught === error,
  );
  assert.equal(record.mock.callCount(), 1);
});

test("waits for discovery before returning its result", async () => {
  let resolve!: (value: Awaited<ReturnType<RecordBatch>>) => void;
  const pending = new Promise<Awaited<ReturnType<RecordBatch>>>((done) => {
    resolve = done;
  });
  mock.method(service, "recordDiscoveredScores", () => pending);
  let finished = false;
  const result = processDiscoveredScores([qualifyingScore()]).then((value) => {
    finished = true;
    return value;
  });
  try {
    await new Promise<void>((done) => setImmediate(done));
    assert.equal(finished, false);
  } finally {
    resolve([]);
  }
  assert.deepEqual(await result, { rejectedCount: 0, failures: [] });
});

function observeCycle() {
  return {
    read: mock.method(cursors, "findCursorByStream"),
    fetch: mock.method(upstream, "fetchScoresBatch"),
    record: mock.method(service, "recordDiscoveredScores"),
    save: mock.method(cursors, "upsertCursor"),
  };
}

test("existing cursor fetches and persists parsed evidence before advancing", async () => {
  const calls: string[] = [];
  const score = qualifyingScore();
  const { beatmap, beatmapset, ...evidence } = score;
  mock.method(cursors, "findCursorByStream", async (connection: unknown, stream: string) => {
    assert.equal(connection, db); assert.equal(stream, "osu-standard");
    calls.push("read"); return "saved";
  });
  mock.method(upstream, "fetchScoresBatch", async (cursor?: string) => {
    assert.equal(cursor, "saved"); calls.push("fetch");
    return { scores: [score], cursor_string: "next" };
  });
  mock.method(service, "recordDiscoveredScores", async (scores: Parameters<RecordBatch>[0]) => {
    assert.deepEqual(scores, [evidence]); calls.push("record"); return [];
  });
  mock.method(cursors, "upsertCursor", async (connection: unknown, stream: string, cursor: string) => {
    assert.equal(connection, db); assert.equal(stream, "osu-standard");
    assert.equal(cursor, "next"); calls.push("save");
  });
  await discoverScores();
  assert.deepEqual(calls, ["read", "fetch", "record", "save"]);
});

test("initialization saves its boundary, skips initial scores, and continues from that boundary", async () => {
  const observed = observeCycle();
  observed.read.mock.mockImplementation(async () => undefined);
  const events: string[] = [];
  observed.fetch.mock.mockImplementation(async (cursor?: string) => {
    events.push(`fetch:${cursor}`);
    return cursor === undefined
      ? { scores: [null], cursor_string: "boundary" }
      : { scores: [], cursor_string: "next" };
  });
  observed.save.mock.mockImplementation(async (_db, _stream, cursor) => { events.push(`save:${cursor}`); });
  await discoverScores();
  assert.deepEqual(events, ["fetch:undefined", "save:boundary", "fetch:boundary", "save:next"]);
  assert.deepEqual(observed.record.mock.calls.map(call => call.arguments), [[[]]]);
});

test("empty batch with unchanged cursor succeeds", async () => {
  const observed = observeCycle();
  observed.fetch.mock.mockImplementation(async () => ({ scores: [], cursor_string: "saved" }));
  await discoverScores();
  assert.deepEqual(observed.save.mock.calls.map(call => call.arguments), [[db, "osu-standard", "saved"]]);
});

for (const [rejected, failed] of [[1, 0], [0, 1], [1, 1]] as const) {
  test(`rejections=${rejected}, failures=${failed} prevent cursor advancement and retain diagnostics`, async () => {
    const observed = observeCycle();
    const failures = failed ? [{ scoreId: 123, error: new Error("Persistence failed") }] : [];
    observed.fetch.mock.mockImplementation(async () => ({
      scores: rejected ? [qualifyingScore(), null] : [qualifyingScore()], cursor_string: "next",
    }));
    observed.record.mock.mockImplementation(async () => failures);
    await assert.rejects(discoverScores(), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, new RegExp(`${rejected} rejected scores`));
      assert.match(error.message, new RegExp(`${failed} persistence failures`));
      assert.equal(error.cause, failures);
      return true;
    });
    assert.equal(observed.save.mock.callCount(), 0);
  });
}

for (const stage of ["read", "fetch", "record", "save"] as const) {
  test(`${stage} failure propagates and stops subsequent cycle steps`, async () => {
    const observed = observeCycle();
    const error = new Error(`${stage} unavailable`);
    observed[stage].mock.mockImplementation(async () => { throw error; });
    await assert.rejects(discoverScores(), caught => caught === error);
    const order = ["read", "fetch", "record", "save"] as const;
    for (const later of order.slice(order.indexOf(stage) + 1)) {
      assert.equal(observed[later].mock.callCount(), 0);
    }
  });
}

for (const stage of ["fetch", "save"] as const) {
  test(`initial ${stage} failure stops before normal discovery`, async () => {
    const observed = observeCycle();
    observed.read.mock.mockImplementation(async () => undefined);
    const error = new Error(`Initialization ${stage} failed`);
    observed[stage].mock.mockImplementation(async () => { throw error; });
    await assert.rejects(discoverScores(), caught => caught === error);
    assert.equal(observed.fetch.mock.callCount(), 1);
    assert.equal(observed.save.mock.callCount(), stage === "save" ? 1 : 0);
    assert.equal(observed.record.mock.callCount(), 0);
  });
}

test("failed processing after initialization retries from persisted boundary", async () => {
  let stored: string | undefined;
  const observed = observeCycle();
  observed.read.mock.mockImplementation(async () => stored);
  observed.save.mock.mockImplementation(async (_db, _stream, cursor) => { stored = cursor; });
  observed.fetch.mock.mockImplementation(async cursor => ({
    scores: cursor === undefined ? [] : [qualifyingScore()],
    cursor_string: cursor === undefined ? "boundary" : "next",
  }));
  let fail = true;
  observed.record.mock.mockImplementation(async () => fail ? [{ scoreId: 123, error: new Error("Retry") }] : []);
  await assert.rejects(discoverScores());
  assert.equal(stored, "boundary");
  fail = false;
  await discoverScores();
  assert.equal(stored, "next");
  assert.deepEqual(observed.fetch.mock.calls.map(call => call.arguments), [[], ["boundary"], ["boundary"]]);
});

test("cursor advancement waits for asynchronous persistence", async () => {
  const observed = observeCycle();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  observed.record.mock.mockImplementation(async () => { await gate; return []; });
  const cycle = discoverScores();
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(observed.record.mock.callCount(), 1);
    assert.equal(observed.save.mock.callCount(), 0);
  } finally { release(); await cycle; }
  assert.equal(observed.save.mock.callCount(), 1);
});
