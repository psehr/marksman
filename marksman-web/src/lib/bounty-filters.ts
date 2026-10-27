import type { BountyTier, ExtendedBounty } from "@marksman/contracts";

export const tierOptions: readonly BountyTier[] = [
  "Easy", "Normal", "Hard", "Lunatic", "Extra", "Phantasm",
];
export type BountyGoal = ExtendedBounty["goal"]["type"];
export const goalOptions: readonly BountyGoal[] = ["full_combo", "minimum_grade"];
type RequiredMod = Extract<ExtendedBounty["goal"]["modRequirement"], { mods: unknown }>["mods"][number];
export type BountyModFilter = RequiredMod | "NM";
export const modOptions: readonly BountyModFilter[] = [
  "NM", "EZ", "HT", "NF", "DT", "FL", "HD", "HR", "SO",
];

export type AdditionalBountyFilters = {
  tiers: ReadonlySet<BountyTier>;
  goals: ReadonlySet<BountyGoal>;
  mods: ReadonlySet<BountyModFilter>;
};

// Ignore unsupported values and duplicates; option order keeps serialization stable.
export function parseSelection<T extends string>(
  value: string | null,
  options: readonly T[],
): Set<T> {
  const values = new Set(value?.split(",") ?? []);
  return new Set(options.filter(option => values.has(option)));
}

export function parseModSelection(value: string | null): Set<BountyModFilter> {
  const selected = parseSelection(value, modOptions);
  // NM wins for manually supplied URLs containing an impossible NM + mod combination.
  return selected.has("NM") ? new Set(["NM"]) : selected;
}

export function toggleSelection<T extends string>(
  selected: ReadonlySet<T>,
  value: T,
  options: readonly T[],
): string | null {
  const next = new Set(selected);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return options.filter(option => next.has(option)).join(",") || null;
}
