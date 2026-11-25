import ModIcon from "@/components/osu/ModIcon";
import type {
  ModSelection,
  ModsStepProps,
  SelectedMod,
} from "./creation-tool.types";

const mods = ["HR", "HD", "DT", "FL", "EZ", "NF", "HT"] satisfies SelectedMod[];

export default function ModsStep({ props }: { props: ModsStepProps }) {
  const { settings } = props;

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="grid w-fit grid-cols-4 gap-1 sm:grid-cols-7 self-center pb-8">
        {mods.map((mod) => {
          const selection: ModSelection = settings.required.includes(mod)
            ? "required"
            : settings.forbidden.includes(mod)
              ? "forbidden"
              : "optional";
          const states: ModSelection[] = [
            "optional",
            ...(props.bountyType === "pass" && mod === "NF"
              ? []
              : ["required" as const]),
            ...(settings.allowOtherMods ? ["forbidden" as const] : []),
          ];
          const next = states[(states.indexOf(selection) + 1) % states.length];
          const stateLabel =
            selection === "optional" && !settings.allowOtherMods
              ? "not selected"
              : selection;

          return (
            <button
              key={mod}
              type="button"
              aria-label={`${mod}: ${stateLabel}. Click to change to ${next}.`}
              title={`${mod}: ${stateLabel}. Click to change to ${next}.`}
              disabled={states.length === 1}
              onClick={() => props.onModChange(mod, next)}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded px-1 py-2 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-30"
            >
              <span aria-hidden="true" className="pointer-events-none">
                <ModIcon
                  mod={mod}
                  size="lg"
                  crossed={
                    selection === "forbidden" ||
                    (!settings.allowOtherMods && selection === "optional")
                  }
                  grayed={settings.allowOtherMods && selection === "optional"}
                />
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 self-end">
        <input
          type="checkbox"
          className="accent-accent"
          checked={!settings.allowOtherMods}
          onChange={(event) =>
            props.onAllowOtherModsChange(!event.target.checked)
          }
        />
        Exact mods
      </label>

      {props.validationErrors.length > 0 && (
        <div role="alert" className="text-danger">
          {props.validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
