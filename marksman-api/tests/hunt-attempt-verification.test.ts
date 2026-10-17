import assert from "node:assert/strict";
import { test } from "node:test";
import { huntAttemptScoreEvidenceSchema } from "@marksman/contracts";
import { evaluateHuntAttempt, checkHuntAttemptValidity } from "../src/services/bounty-verification";
import { InvalidBeatmapMetadataError } from "../src/services/errors";
import { hunter, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

const start = new Date("2026-09-21T12:00:00Z");
const end = new Date("2026-09-21T12:02:00Z");
for (const [label, time, endedAt, expected] of [
  ["before start", start.getTime() - 1, end, false],
  ["at start", start.getTime(), end, false],
  ["after start", start.getTime() + 1, end, true],
  ["at end", end.getTime(), end, true],
  ["after end", end.getTime() + 1, end, false],
  ["ongoing", end.getTime() + 100000, null, true],
] as const) {
  test(`attempt period: ${label}`, () => {
    const score = huntAttemptScoreEvidenceSchema.parse(qualifyingScore());
    score.ended_at = new Date(time).toISOString();
    const result = evaluateHuntAttempt(score, qualifyingBounty(), hunter, start, endedAt);
    assert.equal(result.scoreIsWithinHuntPeriod, expected);
    assert.equal(checkHuntAttemptValidity(result), expected ? "valid" : "invalid");
  });
}

test("offset timestamps compare by instant and closed bounty status is not eligibility", () => {
  const score = huntAttemptScoreEvidenceSchema.parse(qualifyingScore());
  score.ended_at = "2026-09-21T14:02:00+02:00";
  for (const status of ["completed", "cancelled"] as const) {
    const result = evaluateHuntAttempt(score, { ...qualifyingBounty(), status }, hunter, start, end);
    assert.equal(checkHuntAttemptValidity(result), "valid");
    assert.equal("bountyIsClaimable" in result, false);
    assert.equal("scoreIsSetAfterCreation" in result, false);
  }
});

for (const field of ["playerIsClaimant", "playerIsNotOwner", "beatmapIsCorrect", "rulesetIsCorrect", "scoreIsPassed", "modsAreCorrect", "scoreAccuracyIsSatisfied", "gradeIsSatisfied", "fcIsSatisfied", "scoreIsWithinHuntPeriod"] as const) {
  test(`validity rejects false ${field}`, () => {
    const result = evaluateHuntAttempt(qualifyingScore(), qualifyingBounty(), hunter, start, null);
    assert.equal(checkHuntAttemptValidity({ ...result, [field]: false }), "invalid");
  });
}

test("stable FC needs valid metadata; lazer FC does not", () => {
  const score = huntAttemptScoreEvidenceSchema.parse(qualifyingScore());
  assert.equal(checkHuntAttemptValidity(evaluateHuntAttempt(score, qualifyingBounty(), hunter, start, null)), "valid");
  score.legacy_score_id = 123;
  for (const combo of [undefined, 0, -1]) {
    assert.throws(() => evaluateHuntAttempt(score, qualifyingBounty(), hunter, start, null, combo), InvalidBeatmapMetadataError);
  }
  assert.equal(checkHuntAttemptValidity(evaluateHuntAttempt(score, qualifyingBounty(), hunter, start, null, 1000)), "valid");
  assert.equal(checkHuntAttemptValidity(evaluateHuntAttempt(score, qualifyingBounty(), hunter, start, null, 2000)), "invalid");
});
