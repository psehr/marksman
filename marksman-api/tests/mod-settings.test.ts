import assert from "node:assert/strict";
import { test } from "node:test";
import { createBountySchema, modSettingsSchema, matchesModSettings } from "@marksman/contracts";

test("new settings validate independently required and forbidden lists", () => {
  assert.equal(modSettingsSchema.safeParse({ required: ["HD"], forbidden: ["DT", "HT", "EZ", "HR"], allowOtherMods: true }).success, true);
  for (const input of [
    { required: ["DT", "HT"], forbidden: [], allowOtherMods: true },
    { required: ["EZ", "HR"], forbidden: [], allowOtherMods: true },
    { required: ["HD", "HD"], forbidden: [], allowOtherMods: true },
    { required: [], forbidden: ["HT", "HT"], allowOtherMods: true },
    { required: ["HD"], forbidden: ["HD"], allowOtherMods: true },
    { required: [], forbidden: ["HT"], allowOtherMods: false },
    { required: [], forbidden: [], allowOtherMods: "true" },
    { rule: "any" },
  ]) assert.equal(modSettingsSchema.safeParse(input).success, false, JSON.stringify(input));
});

test("mixed matching requires every required mod, rejects forbidden mods and controls extras", () => {
  const settings = modSettingsSchema.parse({ required: ["HD"], forbidden: ["HT"], allowOtherMods: true });
  assert.equal(matchesModSettings(["HD"], settings), true);
  assert.equal(matchesModSettings(["HD", "HR"], settings), true);
  assert.equal(matchesModSettings([], settings), false);
  assert.equal(matchesModSettings(["HD", "HT"], settings), false);
  const exact = { ...settings, forbidden: [], allowOtherMods: false };
  assert.equal(matchesModSettings(["HD"], exact), true);
  assert.equal(matchesModSettings(["HD", "HR"], exact), false);
  assert.equal(matchesModSettings([], { required: [], forbidden: [], allowOtherMods: false }), true);
});

test("missing requirements default to unrestricted, independent of creation UI defaults", () => {
  const parsed = createBountySchema.parse({ rewardBp: 100, goal: { type: "pass", beatmapId: 1 } });
  assert.deepEqual(parsed.goal.modRequirement, { required: [], forbidden: [], allowOtherMods: true });
});
