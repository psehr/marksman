import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  OsuBeatmapMetadata,
  Bounty,
  OsuGrade,
  ScoreResponse,
} from "@marksman/contracts";
import {
  evaluateBountyCompletion,
  isBountyCompletionValid,
} from "../src/services/bounty-verification";
import { InvalidBeatmapMetadataError } from "../src/services/errors";
import {
  hunter,
  metadata,
  qualifyingBounty,
  qualifyingScore,
} from "./fixtures/completion";

function checkCompletion(
  ...args: Parameters<typeof evaluateBountyCompletion>
): boolean {
  return isBountyCompletionValid(evaluateBountyCompletion(...args));
}

for (const type of ["full_combo", "minimum_grade"] as const) {
  const cases: Array<[string, (s: ScoreResponse, b: Bounty) => void]> = [
    [
      "another player's score",
      (s) => {
        s.user_id++;
      },
    ],
    [
      "creator claiming",
      (_s, b) => {
        b.creatorOsuUserId = hunter.osuUserId;
      },
    ],
    ...(["draft", "completed", "cancelled"] as const).map(
      (status) =>
        [
          `${status} bounty`,
          (_s: ScoreResponse, b: Bounty) => {
            b.status = status;
          },
        ] as (typeof cases)[number],
    ),
    [
      "different difficulty",
      (s) => {
        s.beatmap_id++;
      },
    ],
    ...[1, 2, 3].map(
      (mode) =>
        [
          `ruleset ${mode}`,
          (s: ScoreResponse) => {
            s.ruleset_id = mode;
          },
        ] as (typeof cases)[number],
    ),
    [
      "earlier score",
      (s) => {
        s.ended_at = "2026-09-21T11:59:59Z";
      },
    ],
    [
      "same creation timestamp",
      (s, b) => {
        s.ended_at = b.createdAt;
      },
    ],
    [
      "failed score",
      (s) => {
        s.passed = false;
      },
    ],
    [
      "insufficient accuracy",
      (s, b) => {
        b.goal.minimumAccuracy = 99;
        s.accuracy = 0.98999;
      },
    ],
    [
      "missing required mod",
      (_s, b) => {
        b.goal.modRequirement = { rule: "includes", mods: ["HD"] };
      },
    ],
  ];
  test(`${type}: qualifying score passes`, () => {
    const b = qualifyingBounty();
    if (type === "minimum_grade")
      b.goal = { ...b.goal, type, minimumGradeRequirement: "A" };
    assert.equal(checkCompletion(qualifyingScore(), b, hunter, metadata), true);
  });
  for (const [name, change] of cases) {
    test(`${type}: rejects ${name}`, () => {
      const s = qualifyingScore(),
        b = qualifyingBounty();
      if (type === "minimum_grade")
        b.goal = { ...b.goal, type, minimumGradeRequirement: "A" };
      change(s, b);
      assert.equal(checkCompletion(s, b, hunter, metadata), false);
    });
  }
}

for (const [time, expected] of [
  ["2026-09-21T14:00:00+02:00", false],
  ["2026-09-21T14:00:00.001+02:00", true],
] as const)
  test(`timestamps compare instants: ${time}`, () => {
    assert.equal(
      checkCompletion(
        { ...qualifyingScore(), ended_at: time },
        qualifyingBounty(),
        hunter,
        metadata,
      ),
      expected,
    );
  });

for (const [minimum, accuracy, expected] of [
  [undefined, 0, true],
  [0, 0, true],
  [29, 0.29, true],
  [29, 0.289999, false],
  [29, 0.290001, true],
  [100, 1, true],
  [100, 0.999999, false],
] as const)
  test(`accuracy minimum ${minimum}, score ${accuracy}`, () => {
    const b = qualifyingBounty();
    b.goal.minimumAccuracy = minimum;
    assert.equal(
      checkCompletion({ ...qualifyingScore(), accuracy }, b, hunter, metadata),
      expected,
    );
  });

const modCases: Array<[Bounty["goal"]["modRequirement"], string[], boolean]> = [
  [{ rule: "any" }, [], true],
  [{ rule: "any" }, ["UNRECOGNIZED"], true],
  [{ rule: "exact", mods: [] }, [], true],
  [{ rule: "exact", mods: [] }, ["HD"], false],
  [{ rule: "exact", mods: ["HD", "HR"] }, ["HR", "HD"], true],
  [{ rule: "exact", mods: ["HD", "HR"] }, ["HD"], false],
  [{ rule: "exact", mods: ["HD"] }, ["HR"], false],
  [{ rule: "exact", mods: ["HD"] }, ["HD", "UNRECOGNIZED"], false],
  [
    { rule: "includes", mods: ["HD", "HR"] },
    ["HR", "HD", "UNRECOGNIZED"],
    true,
  ],
  [{ rule: "includes", mods: ["HD", "HR"] }, ["HD"], false],
  [{ rule: "excludes", mods: ["HD", "HR"] }, [], true],
  [{ rule: "excludes", mods: ["HD", "HR"] }, ["UNRECOGNIZED"], true],
  [{ rule: "excludes", mods: ["HD", "HR"] }, ["HR"], false],
];
for (const [requirement, acronyms, expected] of modCases) {
  test(`mods ${JSON.stringify(requirement)} against ${JSON.stringify(acronyms)}`, () => {
    const b = qualifyingBounty();
    b.goal.modRequirement = requirement;
    const s = qualifyingScore();
    s.mods = acronyms.map((acronym) => ({ acronym }));
    assert.equal(checkCompletion(s, b, hunter, metadata), expected);
  });
}

// Explicit equivalence groups express the product rule independently of the helper's map.
const grades: OsuGrade[][] = [
  ["F"],
  ["D"],
  ["C"],
  ["B"],
  ["A"],
  ["S", "SH"],
  ["X", "XH"],
];
for (const [requiredLevel, requirements] of grades.entries())
  for (const requirement of requirements) {
    if (requirement === "F") continue;
    for (const [achievedLevel, achieved] of grades.entries())
      for (const rank of achieved) {
        test(`grade ${rank} against minimum ${requirement}`, () => {
          const b = qualifyingBounty();
          b.goal = {
            ...b.goal,
            type: "minimum_grade",
            minimumGradeRequirement: requirement,
          };
          // A grade goal must not accidentally require an FC or its metadata.
          const goalMetadata = { ...metadata, max_combo: 0 };
          const s = {
            ...qualifyingScore(),
            legacy_score_id: 123,
            rank,
            max_combo: 1,
            statistics: { miss: 5 },
          };
          assert.equal(
            checkCompletion(s, b, hunter, goalMetadata),
            achievedLevel >= requiredLevel,
          );
        });
      }
  }

for (const [threshold, combo, expected] of [
  [undefined, 990, true],
  [undefined, 989, false],
  [0.95, 950, true],
  [0.95, 949, false],
  [1, 999, false],
  [1, 1000, true],
] as const)
  test(`stable FC threshold ${threshold}, combo ${combo}`, () => {
    const b = qualifyingBounty();
    assert.equal(b.goal.type, "full_combo");
    if (b.goal.type === "full_combo") b.goal.minimumComboRatio = threshold;
    assert.equal(
      checkCompletion(
        { ...qualifyingScore(), legacy_score_id: 123, max_combo: combo },
        b,
        hunter,
        metadata,
      ),
      expected,
    );
  });

test("stable FC rejects a miss even with enough combo", () => {
  const s = qualifyingScore();
  s.legacy_score_id = 123;
  s.statistics.miss = 1;
  assert.equal(checkCompletion(s, qualifyingBounty(), hunter, metadata), false);
});
test("stable FC accepts sparse miss statistics", () => {
  const s = qualifyingScore();
  s.legacy_score_id = 123;
  s.statistics = {};
  assert.equal(checkCompletion(s, qualifyingBounty(), hunter, metadata), true);
});
for (const max of [undefined, 0, -1])
  test(`stable FC rejects unavailable/invalid max combo ${max}`, () => {
    const b = qualifyingBounty();
    // Deliberately malformed upstream data exercises the verifier's defensive check.
    const goalMetadata = { ...metadata, max_combo: max } as OsuBeatmapMetadata;
    assert.throws(
      () =>
        checkCompletion(
          { ...qualifyingScore(), legacy_score_id: 123 },
          b,
          hunter,
          goalMetadata,
        ),
      InvalidBeatmapMetadataError,
    );
  });
for (const stat of ["miss", "large_tick_miss", "combo_break"] as const) {
  test(`lazer FC rejects ${stat}`, () => {
    const s = qualifyingScore();
    s.statistics[stat] = 1;
    assert.equal(
      checkCompletion(s, qualifyingBounty(), hunter, metadata),
      false,
    );
  });
}
for (const legacyId of [null, undefined])
  test(`lazer FC ignores combo threshold and allows sparse counts (legacy ID ${legacyId})`, () => {
    const b = qualifyingBounty();
    const goalMetadata = { ...metadata, max_combo: 0 };
    if (b.goal.type === "full_combo") b.goal.minimumComboRatio = 1;
    const s = {
      ...qualifyingScore(),
      legacy_score_id: legacyId,
      max_combo: 500,
      statistics: {},
    };
    assert.equal(checkCompletion(s, b, hunter, goalMetadata), true);
  });
test("lazer dropped slider ends do not disqualify an otherwise qualifying FC", () => {
  const s = {
    ...qualifyingScore(),
    max_combo: 900,
    statistics: { miss: 0, ignore_miss: 10 },
  };
  assert.equal(checkCompletion(s, qualifyingBounty(), hunter, metadata), true);
});
test("failed eligibility does not hide FC metadata errors during full evaluation", () => {
  const b = qualifyingBounty();
  const goalMetadata = { ...metadata, max_combo: 0 };
  assert.throws(
    () =>
      evaluateBountyCompletion(
        { ...qualifyingScore(), legacy_score_id: 123, passed: false },
        b,
        hunter,
        goalMetadata,
      ),
    InvalidBeatmapMetadataError,
  );
});

test("FC evaluation reports every check and leaves grade inapplicable", () => {
  const result = evaluateBountyCompletion(
    qualifyingScore(),
    qualifyingBounty(),
    hunter,
    metadata,
  );
  assert.deepEqual(result, {
    playerIsClaimant: true,
    bountyIsClaimable: true,
    playerIsNotOwner: true,
    beatmapIsCorrect: true,
    rulesetIsCorrect: true,
    scoreIsSetAfterCreation: true,
    scoreIsPassed: true,
    scoreAccuracyIsSatisfied: undefined,
    modsAreCorrect: true,
    fcIsSatisfied: true,
    gradeIsSatisfied: undefined,
  });
  assert.equal(isBountyCompletionValid(result), true);
});

test("grade evaluation reports failure without evaluating FC metadata", () => {
  const b = qualifyingBounty();
  b.goal = { ...b.goal, type: "minimum_grade", minimumGradeRequirement: "S" };
  const result = evaluateBountyCompletion(
    { ...qualifyingScore(), rank: "A", legacy_score_id: 123 },
    b,
    hunter,
    { ...metadata, max_combo: 0 },
  );
  assert.equal(result.gradeIsSatisfied, false);
  assert.equal(result.fcIsSatisfied, undefined);
  assert.equal(isBountyCompletionValid(result), false);
});

test("evaluation retains simultaneous failures instead of short-circuiting", () => {
  const b = qualifyingBounty();
  b.goal.minimumAccuracy = 99;
  b.goal.modRequirement = { rule: "includes", mods: ["HD"] };
  const result = evaluateBountyCompletion(
    {
      ...qualifyingScore(),
      passed: false,
      accuracy: 0.95,
      mods: [],
      statistics: { miss: 1 },
    },
    b,
    hunter,
    metadata,
  );
  assert.equal(result.scoreIsPassed, false);
  assert.equal(result.scoreAccuracyIsSatisfied, false);
  assert.equal(result.modsAreCorrect, false);
  assert.equal(result.fcIsSatisfied, false);
  assert.equal(result.playerIsClaimant, true);
  assert.equal(isBountyCompletionValid(result), false);
});

test("aggregate validity rejects each failed field even with inapplicable fields", () => {
  const valid = evaluateBountyCompletion(
    qualifyingScore(),
    qualifyingBounty(),
    hunter,
    metadata,
  );
  for (const field of Object.keys(valid)) {
    assert.equal(
      isBountyCompletionValid({ ...valid, [field]: false }),
      false,
      field,
    );
  }
  const { gradeIsSatisfied, ...withoutGrade } = valid;
  assert.equal(isBountyCompletionValid(withoutGrade), true);
});
