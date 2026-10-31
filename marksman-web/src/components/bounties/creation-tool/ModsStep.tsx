import Button from "@/components/ui/Button";
import ModIcon from "@/components/osu/ModIcon";
import { bountyModFilterSchema } from "@marksman/contracts";
import type { ModRule, ModsStepProps } from "./creation-tool.types";

const mods = bountyModFilterSchema.exclude(["NM"]).options;
const rules = [
  { value: "any", label: "Any mods" },
  { value: "exact", label: "Exactly these mods" },
  { value: "includes", label: "Include these mods" },
  { value: "excludes", label: "Exclude these mods" },
] satisfies { value: ModRule; label: string }[];

export default function ModsStep({ props }: { props: ModsStepProps }) {
  return (
    <div className="flex w-full flex-col items-start gap-4 text-left">
      <fieldset className="flex flex-col gap-2">
        <legend>Mod rule</legend>
        {rules.map(({ value, label }) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded border border-border p-2 px-4 hover:bg-surface-hover"
          >
            <input
              type="radio"
              name="mod-rule"
              value={value}
              checked={props.selectedModRule === value}
              onChange={() => props.setSelectedModRule(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {props.selectedModRule !== "any" ? (
        <fieldset className="flex w-full flex-col gap-2">
          <legend>Mods</legend>
          <div className="flex flex-wrap gap-2">
            {mods.map((mod) => (
              <label
                key={mod}
                className="flex cursor-pointer items-center gap-2 rounded border border-border p-2 hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  aria-label={mod}
                  checked={props.selectedMods.includes(mod)}
                  onChange={(event) =>
                    props.onModToggle(mod, event.target.checked)
                  }
                />
                <ModIcon
                  mod={mod}
                  crossed={props.selectedModRule === "excludes"}
                />
              </label>
            ))}
          </div>
          <p>
            {props.selectedModRule === "exact"
              ? "Leave all unchecked to require no mods (NM)."
              : "Select at least one mod."}
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
