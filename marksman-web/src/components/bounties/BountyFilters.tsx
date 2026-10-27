import { aes_font } from "@/lib/fonts";
import { useAuth } from "../auth/AuthProvider";
import BountyTierBadge from "./BountyTierBadge";
import type { BountyTier } from "@marksman/contracts";
import {
  tierOptions,
  modOptions,
  type AdditionalBountyFilters,
  type BountyGoal,
  type BountyModFilter,
} from "@/lib/bounty-filters";
import ModIcon from "../osu/ModIcon";

export type BountySortingMethod = {
  type: "date" | "bpReward";
  order: "asc" | "desc";
};

function FilterButton({
  pressed,
  children,
  disabled = false,
  onClick,
  className,
  "aria-label": ariaLabel,
}: {
  pressed?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      className={`bg-surface text-sm border-border aria-pressed:border-accent enabled:hover:bg-surface-hover rounded border-2 h-10 px-4 enabled:cursor-pointer disabled:opacity-20 ${className}`}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      type="button"
      // autocomplete disabling fixes a Firefox-only hydration error
      {...{ autoComplete: "off" }}
    >
      {children}
    </button>
  );
}

function IconFilterButton({
  onClick,
  pressed = false,
  children,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="opacity-40 aria-pressed:opacity-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      type="button"
    >
      {children}
    </button>
  );
}

export default function BountyFilters(props: {
  searchInput: string;
  bountyType: "open" | "completed";
  setBountyType: (status: "open" | "completed") => void;
  setSearchInput: (input: string) => void;
  setSelectedSortingMethod: (input: BountySortingMethod) => void;
  selectedSortingMethod: BountySortingMethod;
  relationship: "created" | "bookmarked" | null;
  setRelationship: (relationship: "created" | "bookmarked" | null) => void;
  foundBountiesCount: number;
  selectedFilters: AdditionalBountyFilters;
  onToggleTier: (tier: BountyTier) => void;
  onToggleGoal: (goal: BountyGoal) => void;
  onToggleMod: (mod: BountyModFilter) => void;
}) {
  const { user } = useAuth();
  const isLogged = user?.identity !== undefined;

  return (
    <div
      className={`bg-surface border-border flex h-full w-full flex-col gap-4 rounded border p-4`}
    >
      <input
        type="text"
        className={`${aes_font.className} bg-background focus-visible:outline-accent flex h-12 w-full rounded-sm px-4 text-left text-xl font-bold focus-visible:outline-2`}
        placeholder="Search bounties..."
        aria-label="Search bounties..."
        value={props.searchInput}
        onChange={(event) => {
          props.setSearchInput(event.currentTarget.value);
        }}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr_1fr]">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-foreground-muted text-lg font-bold">
            Status
          </legend>
          <div className="flex flex-wrap gap-4">
            <FilterButton
              pressed={props.bountyType === "open"}
              onClick={() => props.setBountyType("open")}
            >
              Open
            </FilterButton>
            <FilterButton
              pressed={props.bountyType === "completed"}
              onClick={() => props.setBountyType("completed")}
            >
              Completed
            </FilterButton>
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-foreground-muted text-lg font-bold">
            Show
          </legend>
          <div className="flex flex-wrap gap-4">
            <FilterButton
              pressed={!props.relationship || !isLogged}
              onClick={() => props.setRelationship(null)}
            >
              All
            </FilterButton>
            <FilterButton
              pressed={props.relationship === "bookmarked" && isLogged}
              onClick={() => props.setRelationship("bookmarked")}
              disabled={!isLogged}
            >
              Bookmarked
            </FilterButton>
            <FilterButton
              pressed={props.relationship === "created" && isLogged}
              onClick={() => props.setRelationship("created")}
              disabled={!isLogged}
            >
              Created
            </FilterButton>
            <FilterButton onClick={() => {}} disabled>
              Hunting
            </FilterButton>
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="bounty-sort"
            className="text-foreground-muted text-lg font-bold"
          >
            Sort by
          </label>
          <div className="flex gap-2">
            <select
              id="bounty-sort"
              className="rounded border-2 border-border bg-surface px-4 h-10 text-sm"
              value={props.selectedSortingMethod.type}
              onChange={(event) => {
                const type = event.currentTarget.value;
                if (type !== "date" && type !== "bpReward") return;

                props.setSelectedSortingMethod({
                  ...props.selectedSortingMethod,
                  type,
                });
              }}
            >
              <option value="date">Date</option>
              <option value="bpReward">Reward</option>
            </select>
            <FilterButton
              onClick={() => {
                props.setSelectedSortingMethod({
                  type: props.selectedSortingMethod.type,
                  order:
                    props.selectedSortingMethod.order === "asc"
                      ? "desc"
                      : "asc",
                });
              }}
              aria-label={
                props.selectedSortingMethod.order === "asc"
                  ? "Ascending order; switch to descending"
                  : "Descending order; switch to ascending"
              }
              className="text-lg font-bold"
            >
              {props.selectedSortingMethod.order === "asc" ? "↑" : "↓"}
            </FilterButton>
          </div>
        </div>
      </div>
      <details className="border-t border-border pt-4 text-center text-foreground-muted">
        <summary className="cursor-pointer">Show additional filters</summary>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-foreground-muted font-bold">
              Reward Tier
            </legend>
            <div className="flex flex-wrap justify-center gap-2">
              {tierOptions.map((tier) => (
                <IconFilterButton
                  onClick={() => props.onToggleTier(tier)}
                  pressed={props.selectedFilters.tiers.has(tier)}
                  key={tier}
                >
                  <BountyTierBadge tier={tier} size="md" />
                </IconFilterButton>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-foreground-muted font-bold">
              Goal Type
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <IconFilterButton
                onClick={() => props.onToggleGoal("full_combo")}
                pressed={props.selectedFilters.goals.has("full_combo")}
              >
                <div className="flex place-content-center items-center min-w-24 h-8 border border-border">
                  <span>Full-Combo</span>
                </div>
              </IconFilterButton>
              <IconFilterButton
                onClick={() => props.onToggleGoal("minimum_grade")}
                pressed={props.selectedFilters.goals.has("minimum_grade")}
              >
                <div className="flex place-content-center items-center min-w-24 h-8 border border-border">
                  <span>Minimum Grade</span>
                </div>
              </IconFilterButton>
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-foreground-muted font-bold">
              Mods
            </legend>
            <p className="mb-2 text-xs">
              Requires all selected mods. NM means exact no mods.
            </p>
            {modOptions.map((mod) => (
              <IconFilterButton
                onClick={() => props.onToggleMod(mod)}
                pressed={props.selectedFilters.mods.has(mod)}
                key={mod}
              >
                <ModIcon mod={mod} size="md" />
              </IconFilterButton>
            ))}
          </fieldset>
        </div>
      </details>
    </div>
  );
}
