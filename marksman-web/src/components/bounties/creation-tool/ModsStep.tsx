import Button from "@/components/ui/Button";
import ModIcon from "@/components/osu/ModIcon";
import type {
  ModRule,
  ModsStepProps,
  SelectedMod,
} from "./creation-tool.types";
import {
  radioIconLabelClassName,
  radioTextualLabelClassName,
} from "./GoalStep";

const mods = [
  "HR",
  "HD",
  "DT",
  "FL",
  "EZ",
  "NF",
  "HT",
  "SO",
] satisfies SelectedMod[];

const rules = [
  { value: "any", label: "Any mods" },
  { value: "exact", label: "Exact mods" },
  { value: "includes", label: "Include mods" },
  { value: "excludes", label: "Exclude mods" },
] satisfies { value: ModRule; label: string }[];

export default function ModsStep({ props }: { props: ModsStepProps }) {
  return (
    <div className="flex w-full flex-col items-start text-left gap-2">
      <fieldset className="w-full flex gap-2">
        <legend className="sr-only">Mod rule</legend>
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
          {rules.map(({ value, label }) => (
            <label key={value} className={radioTextualLabelClassName}>
              <input
                className="sr-only"
                type="radio"
                name="mod-rule"
                value={value}
                checked={props.selectedModRule === value}
                onChange={() => {
                  props.setSelectedModRule(value);
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {props.selectedModRule !== "any" ? (
        <fieldset className="flex w-full flex-col gap-2">
          <legend className="sr-only">Mods</legend>
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
            {mods.map((mod) => (
              <label
                key={mod}
                className={radioIconLabelClassName}
                aria-disabled={props.bountyType === "pass" && mod === "NF"}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  aria-label={mod}
                  checked={props.selectedMods.includes(mod)}
                  onChange={(event) =>
                    props.onModToggle(mod, event.target.checked)
                  }
                  disabled={props.bountyType === "pass" && mod === "NF"}
                />
                <ModIcon
                  mod={mod}
                  crossed={props.selectedModRule === "excludes"}
                  size="lg"
                />
              </label>
            ))}
          </div>
          <p>
            {props.selectedModRule === "exact"
              ? "Leave all unchecked to require no mods (NM)."
              : null}
          </p>
        </fieldset>
      ) : (
        <p>Any mod combination is allowed.</p>
      )}
      {props.validationErrors.length > 0 ? (
        <div role="alert" className="text-danger">
          {props.validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2 w-full place-content-end">
        <Button onClick={props.onBack} variant="outline">
          Back
        </Button>
        <Button
          onClick={props.onContinue}
          variant="accent"
          disabled={props.validationErrors.length > 0}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
