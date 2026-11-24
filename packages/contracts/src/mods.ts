import { z } from "zod";

const supportedMods = ["EZ", "HD", "HR", "DT", "HT", "FL", "NF"] as const;

const conflictingModPairs = [
  ["DT", "HT"],
  ["EZ", "HR"],
] as const;

const modAcronymSchema = z.enum(supportedMods);

const modListSchema = z
  .array(modAcronymSchema)
  .max(10)
  .refine((mods) => new Set(mods).size === mods.length, {
    message: "Mods must not contain duplicates",
  });

export const modsSchema = modListSchema.refine(
  (mods) =>
    conflictingModPairs.every(
      ([first, second]) => !(mods.includes(first) && mods.includes(second)),
    ),
  { message: "Mods must not contain conflicting combinations" },
);

export const modSettingsSchema = z
  .object({
    required: modsSchema,
    forbidden: modListSchema,
    allowOtherMods: z.boolean(),
  })
  .refine(
    ({ required, forbidden }) =>
      required.every((mod) => !forbidden.includes(mod)),
    {
      message: "A mod cannot be both required and forbidden.",
      path: ["forbidden"],
    },
  )
  .refine(
    ({ forbidden, allowOtherMods }) => allowOtherMods || forbidden.length === 0,
    {
      message: "Forbidden mods must be empty when other mods are disabled.",
      path: ["forbidden"],
    },
  );

export type ModSettings = z.infer<typeof modSettingsSchema>;

export function matchesModSettings(
  mods: z.infer<typeof modsSchema>,
  settings: ModSettings,
): boolean {
  return (
    settings.required.every((requiredMod) => mods.includes(requiredMod)) &&
    settings.forbidden.every((forbiddenMod) => !mods.includes(forbiddenMod)) &&
    (settings.allowOtherMods ||
      mods.every((mod) => settings.required.includes(mod)))
  );
}

export const osuModSchema = z.object({
  acronym: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const bountyModFilterSchema = z.enum([...supportedMods, "NM"]);
