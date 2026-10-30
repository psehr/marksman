import { z } from "zod";

const supportedMods = ["EZ", "HD", "HR", "DT", "HT", "FL", "NF", "SO"] as const;

const conflictingModPairs = [
  ["DT", "HT"],
  ["EZ", "HR"],
] as const;

const modAcronymSchema = z.enum(supportedMods);

export const modsSchema = z
  .array(modAcronymSchema)
  .max(10)
  .refine((mods) => new Set(mods).size === mods.length, {
    message: "Mods must not contain duplicates",
  })
  .refine(
    (mods) =>
      conflictingModPairs.every(
        ([first, second]) => !(mods.includes(first) && mods.includes(second)),
      ),
    { message: "Mods must not contain conflicting combinations" },
  );

export const modRequirementSchema = z.discriminatedUnion("rule", [
  // the mods can be anything
  z.object({
    rule: z.literal("any"),
  }),
  // the mods have to strictly be correspondent
  z.object({
    rule: z.literal("exact"),
    mods: modsSchema,
  }),
  // the mods must include a positive set of mods
  z.object({
    rule: z.literal("includes"),
    mods: modsSchema.min(1),
  }),
  // the mods must exclude a positive set of mods
  z.object({
    rule: z.literal("excludes"),
    mods: modsSchema.min(1),
  }),
]);

export const osuModSchema = z.object({
  acronym: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const bountyModFilterSchema = z.enum([...supportedMods, "NM"]);
