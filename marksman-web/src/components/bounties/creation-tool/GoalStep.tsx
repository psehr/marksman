import ActionIcon from "@/components/ui/ActionIcon";
import Button from "@/components/ui/Button";
import type { GoalStepProps } from "./creation-tool.types";

export const radioTextualLabelClassName =
  "flex cursor-pointer text-center items-center place-content-center gap-2 rounded border border-border p-2 px-4 hover:bg-surface-hover has-checked:bg-accent has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-accent";

export const radioIconLabelClassName =
  "flex cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:opacity-20 items-center place-content-center gap-2 rounded border border-border p-2 px-4 hover:bg-surface-hover has-checked:bg-surface-hover has-checked:border-accent has-checked:ring-2 has-checked:ring-accent has-focus-visible:outline-2 has-focus-visible:outline-accent has-focus-visible:outline-offset-4";

import { osuGradeSchema } from "@marksman/contracts";
import GradeIcon from "@/components/osu/GradeIcon";
import Link from "next/link";
const minimumGrades = osuGradeSchema.exclude(["F", "SH", "XH"]).options;

export default function GoalStep({ props }: { props: GoalStepProps }) {
  const minimumRequiredCombo =
    props.beatmapMaxCombo !== null
      ? Math.ceil(
          (props.beatmapMaxCombo * props.selectedMinimumComboPercentage) / 100,
        )
      : null;

  const maxCombo = props.beatmapMaxCombo;

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
          Pass
          <input
            className="sr-only"
            type="radio"
            name="type"
            value="pass"
            checked={props.selectedBountyType === "pass"}
            onChange={() => {
              props.setSelectedBountyType("pass");
            }}
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
        <fieldset className="flex w-full flex-col gap-2 sm:items-end">
          <legend className="sr-only">Customize stable combo threshold</legend>
          <label className="flex items-start gap-2 text-left sm:text-right">
            <input
              type="checkbox"
              className="accent-accent mt-1 shrink-0"
              checked={props.customizeStableComboThreshold}
              onChange={(event) =>
                props.setCustomizeStableComboThreshold(event.target.checked)
              }
            />
            <p>
              Customize stable combo threshold{" "}
              <Link
                href="/about/bounties#fc-ruling"
                className="underline text-sm text-foreground-muted"
              >
                (what's this?)
              </Link>
            </p>
          </label>
          {props.customizeStableComboThreshold ? (
            <label className="flex flex-col w-full items-end">
              <div className="flex flex-col sm:gap-2 sm:flex-row tabular-nums">
                <span>Threshold: {props.selectedMinimumComboPercentage}%</span>
                <span>•</span>
                <span>Minimum required combo: </span>
                {minimumRequiredCombo && maxCombo ? (
                  <span>
                    {minimumRequiredCombo} / {props.beatmapMaxCombo}
                  </span>
                ) : (
                  <span>data unavailable</span>
                )}
              </div>

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
      <fieldset className="flex w-full flex-col gap-2 sm:items-end">
        <legend className="sr-only">Minimum accuracy (optional)</legend>
        <label className="flex items-start gap-2 text-left sm:text-right">
          <input
            type="checkbox"
            className="accent-accent mt-1 shrink-0"
            checked={props.requireMinimumAccuracy}
            onChange={(event) =>
              props.setRequireMinimumAccuracy(event.target.checked)
            }
          />
          Require minimum accuracy
        </label>
        {props.requireMinimumAccuracy ? (
          <label className="flex flex-col tabular-nums w-full items-end">
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
          <ActionIcon action="back" />
          Back
        </Button>

        <Button onClick={props.onContinue} variant="accent">
          Continue
          <ActionIcon action="continue" />
        </Button>
      </div>
    </div>
  );
}
