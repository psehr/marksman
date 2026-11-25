import assert from "node:assert/strict";
import { test } from "node:test";
import { createBountySchema, bountySearchQuerySchema, type Bounty } from "@marksman/contracts";
import { evaluateBountyCompletion, evaluateHuntAttempt, isBountyCompletionValid, checkHuntAttemptValidity } from "../src/services/bounty-verification";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

function passBounty(): Bounty {
  const bounty = qualifyingBounty();
  bounty.goal = { type: "pass", beatmapId: bounty.goal.beatmapId, beatmapChecksum: null, modRequirement: { required: [], forbidden: [], allowOtherMods: true } };
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
      ...bounty.goal, modRequirement: {
        required: rule === "exact" || rule === "includes" ? [...(mods ?? [])] : [],
        forbidden: rule === "excludes" ? [...(mods ?? [])] : [],
        allowOtherMods: rule !== "exact",
      },
    } });
    assert.equal(result.success, accepted);
    if (!result.success) assert.deepEqual(result.error.issues[0].path, ["goal", "modRequirement", "required"]);
  });
}

test("Pass is a valid list goal filter", () => {
  assert.deepEqual(bountySearchQuerySchema.parse({ goals: "pass,full_combo" }).goals, ["pass", "full_combo"]);
});

for (const modRequirement of [
  { required: [], forbidden: [], allowOtherMods: true }, { required: [], forbidden: [], allowOtherMods: false },
  { required: ["HD"], forbidden: [], allowOtherMods: true }, { required: [], forbidden: ["EZ"], allowOtherMods: true },
] as const) {
  test(`Pass verification rejects NF with ${JSON.stringify(modRequirement)} in manual and hunt paths`, () => {
    const bounty = passBounty();
    bounty.goal.modRequirement = JSON.parse(JSON.stringify(modRequirement));
    const score = qualifyingScore();
    score.mods = modRequirement.required.map((acronym) => ({ acronym }));
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

for (const minimumGrade of [undefined, "D"] as const) {
  test(`Full Combo retains NF eligibility with optional grade ${minimumGrade ?? "unset"}`, () => {
    const bounty = qualifyingBounty();
    bounty.goal.minimumGrade = minimumGrade;
    const score = qualifyingScore();
    score.mods = [{ acronym: "NF" }];
    assert.equal(createBountySchema.safeParse({ rewardBp: 25, goal: { ...bounty.goal, modRequirement: { required: ["NF"], forbidden: [], allowOtherMods: false } } }).success, true);
    assert.equal(isBountyCompletionValid(evaluateBountyCompletion(score, bounty, hunter, metadata)), true);
  });
}

test("Pass with a minimum grade still rejects required and played NF", () => {
  const bounty = passBounty();
  bounty.goal.minimumGrade = "D";
  const score = qualifyingScore();
  score.mods = [{ acronym: "NF" }];
  assert.equal(createBountySchema.safeParse({ rewardBp: 25, goal: { ...bounty.goal, modRequirement: { required: ["NF"], forbidden: [], allowOtherMods: true } } }).success, false);
  assert.equal(isBountyCompletionValid(evaluateBountyCompletion(score, bounty, hunter, metadata)), false);
  assert.equal(checkHuntAttemptValidity(evaluateHuntAttempt(score, bounty, hunter, new Date(bounty.createdAt), null)), "invalid");
});
