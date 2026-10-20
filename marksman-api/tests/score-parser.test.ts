import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDiscoveredScores } from "../src/integrations/osu/score-parser";
import { qualifyingScore } from "./fixtures/completion";

function evidence() {
  const { beatmap, beatmapset, ...score } = qualifyingScore();
  return score;
}

test("accepts multiple scores without user or beatmap metadata in input order", () => {
  const first = evidence();
  const second = { ...evidence(), id: first.id + 1, legacy_score_id: 123 };
  assert.deepEqual(parseDiscoveredScores([first, second]), {
    scores: [first, second],
    rejectedCount: 0,
  });
});

test("keeps valid scores around malformed items and counts every rejection", () => {
  const first = evidence();
  const second = { ...evidence(), id: first.id + 1 };
  const invalid = [
    null,
    "score",
    {},
    { ...evidence(), id: "987654" },
    { ...evidence(), accuracy: 99 },
    { ...evidence(), ended_at: "not a timestamp" },
    { ...evidence(), statistics: { miss: -1 } },
  ];
  assert.deepEqual(parseDiscoveredScores([first, ...invalid, second]), {
    scores: [first, second],
    rejectedCount: invalid.length,
  });
});

test("returns empty scores with zero rejections for an empty batch", () => {
  assert.deepEqual(parseDiscoveredScores([]), { scores: [], rejectedCount: 0 });
});

test("returns an empty result and rejection count when every item is malformed", () => {
  assert.deepEqual(parseDiscoveredScores([null, {}, false]), {
    scores: [],
    rejectedCount: 3,
  });
});

test("rejects non-array event payloads", () => {
  for (const payload of [
    undefined,
    null,
    false,
    1,
    "[]",
    {},
    evidence(),
    { scores: [] },
  ]) {
    assert.throws(
      () => parseDiscoveredScores(payload),
      /Unexpected payload shape/,
    );
  }
});

test("returns parsed evidence without extra metadata and leaves input unchanged", () => {
  const input = qualifyingScore();
  const original = structuredClone(input);
  assert.deepEqual(parseDiscoveredScores([input]), {
    scores: [evidence()],
    rejectedCount: 0,
  });
  assert.deepEqual(input, original);
});

test("accepts omitted legacy ID, sparse statistics and offset timestamps", () => {
  const { legacy_score_id, ...score } = evidence();
  const input = {
    ...score,
    statistics: {},
    ended_at: "2026-09-21T14:01:00+02:00",
  };
  assert.deepEqual(parseDiscoveredScores([input]), {
    scores: [input],
    rejectedCount: 0,
  });
});

test("parsing does not filter by ruleset, passing status or duplicate ID", () => {
  const score = { ...evidence(), ruleset_id: 3, passed: false, rank: "F" };
  assert.deepEqual(parseDiscoveredScores([score, score]), {
    scores: [score, score],
    rejectedCount: 0,
  });
});
