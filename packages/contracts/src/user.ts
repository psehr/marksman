import { z } from "zod";

export const userIdentitySchema = z.object({
  id: z.uuid(),
  osuUserId: z.number().int().positive(),
  username: z.string().min(1),
});

export const userStatsSchema = z.object({
  bpBalance: z.number().int().nonnegative(),
});

export const userSchema = z.object({
  identity: userIdentitySchema,
  stats: userStatsSchema,
  createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof userSchema>;
export type UserIdentity = z.infer<typeof userIdentitySchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
