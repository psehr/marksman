import { z } from "zod";
import { extendedBountySchema } from "./bounty";

export const huntStatusEnum = z.enum(["ongoing", "stopped", "closed"]);

export const huntSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  bountyId: z.uuid(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  status: huntStatusEnum,
});

export const userHuntedBountiesSchema = z
  .object({
    hunt: huntSchema,
    bounty: extendedBountySchema,
  })
  .array();

export type UserHuntedBounties = z.infer<typeof userHuntedBountiesSchema>;
export type Hunt = z.infer<typeof huntSchema>;
