import assert from "node:assert/strict";
import { test } from "node:test";
import { bountyModFilterSchema, modSettingsSchema, type ModSettings, type ScoreResponse } from "@marksman/contracts";
import { evaluateBountyCompletion, evaluateHuntAttempt } from "../src/services/bounty-verification";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

const requirements: ModSettings[] = [
  { required: [], forbidden: [], allowOtherMods: true },
  { required: [], forbidden: [], allowOtherMods: false },
  { required: ["HD"], forbidden: [], allowOtherMods: false },
  { required: ["HD"], forbidden: ["HT"], allowOtherMods: true },
];

for (const requirement of requirements) {
  for (const acronym of ["SO", "CL"]) {
    for (const [label, settings, expected] of [
      ["default", undefined, true],
      ["empty settings", {}, true],
      ["custom settings", { custom: true }, false],
    ] as const) {
      test(`${acronym} ${label}: ${JSON.stringify(requirement)}`, () => {
        const bounty = qualifyingBounty();
        bounty.goal.modRequirement = requirement;
        const score = qualifyingScore();
        score.mods = [
          ...requirement.required.map((mod) => ({ acronym: mod })),
          { acronym, ...(settings ? { settings } : {}) },
        ];
        assert.equal(evaluateBountyCompletion(score, bounty, hunter, metadata).modsAreCorrect, expected);
        assert.equal(evaluateHuntAttempt(score, bounty, hunter, new Date(bounty.createdAt), null).modsAreCorrect, expected);
      });
    }
  }
}

test("ignoring SO/CL preserves other restrictions in both verification paths", () => {
  const bounty = qualifyingBounty();
  bounty.goal.type = "pass";
  bounty.goal.modRequirement = { required: ["HD"], forbidden: ["HT"], allowOtherMods: true };
  for (const mods of [[], ["HD", "HT"], ["HD", "NF"], ["HD", "XX"], ["HD", "HD"], ["HD", "DT", "HT"]]) {
    const score = qualifyingScore();
    score.mods = [...mods, "SO", "CL"].map((acronym) => ({ acronym })) as ScoreResponse["mods"];
    assert.equal(evaluateBountyCompletion(score, bounty, hunter, metadata).modsAreCorrect, false);
    assert.equal(evaluateHuntAttempt(score, bounty, hunter, new Date(bounty.createdAt), null).modsAreCorrect, false);
  }
});

test("SO cannot be required, forbidden or used as a board filter", () => {
  assert.equal(modSettingsSchema.safeParse({ required: ["SO"], forbidden: [], allowOtherMods: true }).success, false);
  assert.equal(modSettingsSchema.safeParse({ required: [], forbidden: ["SO"], allowOtherMods: true }).success, false);
  assert.equal(bountyModFilterSchema.safeParse("SO").success, false);
});
