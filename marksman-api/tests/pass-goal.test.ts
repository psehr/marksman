import assert from "node:assert/strict";
import { test } from "node:test";
import { createBountySchema, bountySearchQuerySchema, type Bounty } from "@marksman/contracts";
import { evaluateBountyCompletion, evaluateHuntAttempt, isBountyCompletionValid, checkHuntAttemptValidity } from "../src/services/bounty-verification";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

function passBounty(): Bounty {
  const bounty = qualifyingBounty();
  bounty.goal = { type: "pass", beatmapId: bounty.goal.beatmapId, beatmapChecksum: null, modRequirement: { rule: "any" } };
  return bounty;
}

for (const [rule, mods, accepted] of [
  ["any", undefined, true], ["exact", [], true], ["exact", ["HD"], true],
  ["includes", ["HD"], true], ["excludes", ["NF"], true],
  ["excludes", ["HD"], true], ["exact", ["NF"], false],
  ["includes", ["HD", "NF"], false],
] as const) {
  test(`Pass contract: ${rule} ${mods ?? ""} accepted=${accepted}`, () => {
    const bounty = passBounty();
    const result = createBountySchema.safeParse({ rewardBp: 25, goal: {
      ...bounty.goal, modRequirement: { rule, ...(mods ? { mods: [...mods] } : {}) },
    } });
    assert.equal(result.success, accepted);
    if (!result.success) assert.deepEqual(result.error.issues[0].path, ["goal", "modRequirement", "mods"]);
  });
}

test("Pass is a valid list goal filter", () => {
  assert.deepEqual(bountySearchQuerySchema.parse({ goals: "pass,full_combo" }).goals, ["pass", "full_combo"]);
});

for (const modRequirement of [
  { rule: "any" }, { rule: "exact", mods: [] },
  { rule: "includes", mods: ["HD"] }, { rule: "excludes", mods: ["EZ"] },
] as const) {
  test(`Pass verification rejects NF with ${modRequirement.rule} in manual and hunt paths`, () => {
    const bounty = passBounty();
    bounty.goal.modRequirement = JSON.parse(JSON.stringify(modRequirement));
    const score = qualifyingScore();
    score.mods = modRequirement.rule === "includes" ? [{ acronym: "HD" }] : [];
    assert.equal(isBountyCompletionValid(evaluateBountyCompletion(score, bounty, hunter, metadata)), true);
    assert.equal(checkHuntAttemptValidity(evaluateHuntAttempt(score, bounty, hunter, new Date(bounty.createdAt), null)), "valid");
    score.mods.push({ acronym: "NF" });
    assert.equal(evaluateBountyCompletion(score, bounty, hunter, metadata).modsAreCorrect, false);
    assert.equal(checkHuntAttemptValidity(evaluateHuntAttempt(score, bounty, hunter, new Date(bounty.createdAt), null)), "invalid");
  });
}

test("Pass requires passed and configured accuracy but no FC or grade", () => {
  const bounty = passBounty();
  const score = qualifyingScore();
  score.max_combo = 1;
  score.statistics.miss = 20;
  score.rank = "D";
  let result = evaluateBountyCompletion(score, bounty, hunter, metadata);
  assert.equal(isBountyCompletionValid(result), true);
  assert.equal(result.fcIsSatisfied, undefined);
  assert.equal(result.gradeIsSatisfied, undefined);
  score.passed = false;
  assert.equal(isBountyCompletionValid(evaluateBountyCompletion(score, bounty, hunter, metadata)), false);
  score.passed = true;
  bounty.goal.minimumAccuracy = 100;
  assert.equal(isBountyCompletionValid(evaluateBountyCompletion(score, bounty, hunter, metadata)), false);
});

for (const type of ["minimum_grade", "full_combo"] as const) {
  test(`${type} retains existing NF eligibility`, () => {
    const bounty = qualifyingBounty();
    if (type === "minimum_grade") bounty.goal = { ...bounty.goal, type, minimumGradeRequirement: "D" };
    const score = qualifyingScore();
    score.mods = [{ acronym: "NF" }];
    assert.equal(createBountySchema.safeParse({ rewardBp: 25, goal: { ...bounty.goal, modRequirement: { rule: "exact", mods: ["NF"] } } }).success, true);
    assert.equal(isBountyCompletionValid(evaluateBountyCompletion(score, bounty, hunter, metadata)), true);
  });
}
