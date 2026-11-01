import Button from "@/components/ui/Button";
import type { GoalStepProps } from "./creation-tool.types";

export const radioTextualLabelClassName =
  "flex cursor-pointer items-center place-content-center gap-2 rounded border border-border p-2 px-4 hover:bg-surface-hover has-checked:bg-accent has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-accent";

export const radioIconLabelClassName =
  "flex cursor-pointer items-center place-content-center gap-2 rounded border border-border p-2 px-4 hover:bg-surface-hover has-checked:bg-surface-hover has-checked:border-accent has-checked:ring-2 has-checked:ring-accent has-focus-visible:outline-2 has-focus-visible:outline-accent has-focus-visible:outline-offset-4";

import { osuGradeSchema } from "@marksman/contracts";
import GradeIcon from "@/components/osu/GradeIcon";
import Link from "next/link";
const minimumGrades = osuGradeSchema.exclude(["F", "SH", "XH"]).options;

export default function GoalStep({ props }: { props: GoalStepProps }) {
  return (
    <div className="flex flex-col items-end gap-4 w-full text-end">
      <fieldset className="flex gap-2">
        <legend className="sr-only">Goal Type</legend>
        <label className={radioTextualLabelClassName}>
          Full-Combo
          <input
            className="sr-only"
            type="radio"
            name="type"
            value="full_combo"
            checked={props.selectedBountyType === "full_combo"}
            onChange={() => props.setSelectedBountyType("full_combo")}
          />
        </label>
        <label className={radioTextualLabelClassName}>
          Minimum Grade
          <input
            className="sr-only"
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
          <legend className="sr-only">Minimum Grade</legend>
          {minimumGrades.map((grade) => (
            <label className={radioIconLabelClassName} key={grade}>
              <GradeIcon grade={grade} />
              <input
                className="sr-only"
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
        <fieldset className="flex w-full flex-col gap-2 items-end">
          <legend className="sr-only">Customize stable combo threshold</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-accent"
              checked={props.customizeStableComboThreshold}
              onChange={(event) =>
                props.setCustomizeStableComboThreshold(event.target.checked)
              }
            />
            <p>
              Customize stable combo threshold{" "}
              <Link href="" className="underline text-sm text-foreground-muted">
                (what's this?)
              </Link>
            </p>
          </label>
          {props.customizeStableComboThreshold ? (
            <label className="flex flex-col w-1/2">
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
                className="accent-accent"
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
          ) : null}
        </fieldset>
      ) : null}
      <fieldset className="flex w-full flex-col gap-2 items-end">
        <legend className="sr-only">Minimum accuracy (optional)</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-accent"
            checked={props.requireMinimumAccuracy}
            onChange={(event) =>
              props.setRequireMinimumAccuracy(event.target.checked)
            }
          />
          Require minimum accuracy
        </label>
        {props.requireMinimumAccuracy ? (
          <label className="flex flex-col w-1/2">
            Minimum accuracy: {props.selectedMinimumAccuracy}%
            <input
              type="range"
              className="accent-accent"
              min={0}
              max={100}
              step={1}
              value={props.selectedMinimumAccuracy}
              onChange={(event) =>
                props.setSelectedMinimumAccuracy(event.target.valueAsNumber)
              }
            />
          </label>
        ) : null}
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
