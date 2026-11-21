import z from "zod";

export const DAILY_REWARD_BP = 100;

export const dailyClaimStatusSchema = z.discriminatedUnion("claimedToday", [
  z.object({
    claimedToday: z.literal(false),
  }),
  z.object({
    claimedToday: z.literal(true),
    nextClaimAt: z.iso.datetime(),
  }),
]);

export type DailyClaimStatus = z.infer<typeof dailyClaimStatusSchema>;
