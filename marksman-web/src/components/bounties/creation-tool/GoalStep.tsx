import Button from "@/components/ui/Button";
import type { GoalStepProps } from "./creation-tool.types";

const radioLabelClassName =
  "flex gap-2 place-content-between p-2 px-4 rounded border border-border bg-surface hover:bg-surface-hover cursor-pointer";

import { osuGradeSchema } from "@marksman/contracts";
import GradeIcon from "@/components/osu/GradeIcon";
const minimumGrades = osuGradeSchema.exclude(["F", "SH", "XH"]).options;

export default function GoalStep({ props }: { props: GoalStepProps }) {
  return (
    <div className="flex flex-col items-start gap-4 w-full text-left">
      <fieldset className="flex flex-col gap-2">
        <legend>Goal Type</legend>
        <label className={radioLabelClassName}>
          Full-Combo
          <input
            type="radio"
            name="type"
            value="full_combo"
            checked={props.selectedBountyType === "full_combo"}
            onChange={() => props.setSelectedBountyType("full_combo")}
          />
        </label>
        <label className={radioLabelClassName}>
          Minimum Grade
          <input
            type="radio"
            name="type"
            value="minimum_grade"
            checked={props.selectedBountyType === "minimum_grade"}
            onChange={() => props.setSelectedBountyType("minimum_grade")}
          />
        </label>
      </fieldset>
      {props.selectedBountyType === "minimum_grade" ? (
        <fieldset className="flex flex-wrap gap-1">
          <legend>Minimum Grade</legend>
          {minimumGrades.map((grade) => (
            <label className={radioLabelClassName} key={grade}>
              <GradeIcon grade={grade} />
              <input
                type="radio"
                name="minimum-grade"
                value={grade}
                checked={props.selectedMinimumGrade === grade}
                onChange={() => props.setSelectedMinimumGrade(grade)}
                aria-label={grade === "X" ? "SS" : grade}
              />
            </label>
          ))}
        </fieldset>
      ) : null}
      {props.selectedBountyType === "full_combo" ? (
        <fieldset className="w-full">
          <label className="flex flex-col">
            Minimum Combo Threshold (this only applies for stable scores)
            <span>
              {props.selectedMinimumComboPercentage}% · Minimum combo:{" "}
              {props.beatmapMaxCombo !== null ? (
                <>
                  {Math.ceil(
                    (props.beatmapMaxCombo *
                      props.selectedMinimumComboPercentage) /
                      100,
                  )}
                  {" / "}
                  {props.beatmapMaxCombo}
                </>
              ) : (
                "Combo unavailable"
              )}
            </span>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={props.selectedMinimumComboPercentage}
              onChange={(event) =>
                props.setSelectedMinimumComboPercentage(
                  event.target.valueAsNumber,
                )
              }
            />
          </label>
        </fieldset>
      ) : null}
      <fieldset className="flex w-full flex-col gap-2">
        <legend>Minimum accuracy (optional)</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={props.requireMinimumAccuracy}
            onChange={(event) =>
              props.setRequireMinimumAccuracy(event.target.checked)
            }
          />
          Require minimum accuracy
        </label>
        {props.requireMinimumAccuracy ? (
          <label className="flex flex-col">
            Minimum accuracy: {props.selectedMinimumAccuracy}%
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={props.selectedMinimumAccuracy}
              onChange={(event) =>
                props.setSelectedMinimumAccuracy(event.target.valueAsNumber)
              }
            />
          </label>
        ) : (
          <p>No additional accuracy requirement.</p>
        )}
      </fieldset>
      <div className="flex gap-2 place-content-end w-full">
        <Button onClick={props.onBack} variant="outline">
          Back
        </Button>

        <Button onClick={props.onContinue} variant="accent">
          Continue
        </Button>
      </div>
    </div>
  );
}
