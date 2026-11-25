import assert from "node:assert/strict";
import { test } from "node:test";
import { createBountySchema, bountySearchQuerySchema } from "@marksman/contracts";
import {
  evaluateBountyCompletion,
  evaluateHuntAttempt,
  isBountyCompletionValid,
  checkHuntAttemptValidity,
} from "../src/services/bounty-verification";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

for (const type of ["pass", "full_combo"] as const) {
  for (const scenario of [
    { name: "no grade requirement", grade: undefined, rank: "D", accuracy: 0.98, expected: true },
    { name: "grade below requirement", grade: "S", rank: "A", accuracy: 0.99, expected: false },
    { name: "S accepts SH", grade: "S", rank: "SH", accuracy: 0.98, expected: true },
    { name: "SH accepts S", grade: "SH", rank: "S", accuracy: 0.98, expected: true },
    { name: "X accepts XH", grade: "X", rank: "XH", accuracy: 1, expected: true },
    { name: "XH accepts X", grade: "XH", rank: "X", accuracy: 1, expected: true },
    { name: "higher grade qualifies", grade: "A", rank: "S", accuracy: 0.98, expected: true },
    { name: "grade cannot bypass accuracy", grade: "S", rank: "S", accuracy: 0.97999, expected: false },
  ] as const) {
    test(`${type}: ${scenario.name} in completion and hunt verification`, () => {
      const bounty = qualifyingBounty();
      bounty.goal = { ...bounty.goal, type, minimumGrade: scenario.grade, minimumAccuracy: 98 };
      const score = { ...qualifyingScore(), rank: scenario.rank, accuracy: scenario.accuracy };
      const completion = evaluateBountyCompletion(score, bounty, hunter, metadata);
      const attempt = evaluateHuntAttempt(score, bounty, hunter, new Date(bounty.createdAt), null, metadata.max_combo);
      assert.equal(isBountyCompletionValid(completion), scenario.expected);
      assert.equal(checkHuntAttemptValidity(attempt), scenario.expected ? "valid" : "invalid");
      for (const result of [completion, attempt]) {
        assert.equal(result.gradeIsSatisfied, scenario.grade === undefined ? undefined : scenario.rank !== "A");
        assert.equal(result.scoreAccuracyIsSatisfied, scenario.accuracy >= 0.98);
      }
    });
  }
}

for (const type of ["pass", "full_combo"] as const) {
  test(`${type} contract accepts independent and combined optional requirements`, () => {
    for (const requirements of [{}, { minimumGrade: "S" }, { minimumAccuracy: 98 }, { minimumGrade: "S", minimumAccuracy: 98 }]) {
      const goal = { ...qualifyingBounty().goal, type, ...requirements };
      const result = createBountySchema.safeParse({ rewardBp: 100, goal });
      assert.equal(result.success,true);
      if (result.success) for (const [key,value] of Object.entries(requirements)) {
        assert.equal(Reflect.get(result.data.goal,key),value);
      }
    }
    for (const minimumGrade of ["F", "invalid", null]) {
      assert.equal(createBountySchema.safeParse({ rewardBp: 100, goal: { ...qualifyingBounty().goal, type, minimumGrade } }).success,false);
    }
  });
}

test("removed grade goal type is rejected for creation and filtering", () => {
  assert.equal(createBountySchema.safeParse({ rewardBp: 100, goal: {
    ...qualifyingBounty().goal, type: "minimum_grade", minimumGradeRequirement: "S",
  } }).success,false);
  assert.equal(bountySearchQuerySchema.safeParse({ goals: "minimum_grade" }).success,false);
  assert.deepEqual(bountySearchQuerySchema.parse({ goals: "pass,full_combo" }).goals,["pass","full_combo"]);
});
