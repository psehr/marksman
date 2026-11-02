import assert from "node:assert/strict";
import { test } from "node:test";
import type { Bounty, ScoreResponse } from "@marksman/contracts";
import { evaluateBountyCompletion, evaluateHuntAttempt } from "../src/services/bounty-verification";
import { hunter, metadata, qualifyingBounty, qualifyingScore } from "./fixtures/completion";

const rules: Bounty["goal"]["modRequirement"][] = [
  { rule: "any" },
  { rule: "exact", mods: ["HD"] },
  { rule: "includes", mods: ["HD"] },
  { rule: "excludes", mods: ["HR"] },
];
const cases: [string, ScoreResponse["mods"], boolean][] = [
  ["supported mod without settings", [{ acronym: "HD" }], true],
  ["supported mod with empty settings", [{ acronym: "HD", settings: {} }], true],
  ["custom settings", [{ acronym: "HD", settings: { only_fade_approach_circles: true } }], false],
  ["unsupported extra mod", [{ acronym: "HD" }, { acronym: "UNRECOGNIZED" }], false],
  ["duplicate mods", [{ acronym: "HD" }, { acronym: "HD" }], false],
  ["conflicting mods", [{ acronym: "HD" }, { acronym: "DT" }, { acronym: "HT" }], false],
];
for (const requirement of rules) {
  for (const [label, mods, expected] of cases) {
    test(`${requirement.rule}: ${label} in completion and hunting`, () => {
      const bounty = qualifyingBounty();
      bounty.goal.modRequirement = requirement;
      const score = { ...qualifyingScore(), mods };
      assert.equal(evaluateBountyCompletion(score, bounty, hunter, metadata).modsAreCorrect, expected, "manual completion");
      assert.equal(evaluateHuntAttempt(score, bounty, hunter, new Date(bounty.createdAt), null).modsAreCorrect, expected, "automatic hunting");
    });
  }
}
