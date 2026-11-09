import { z } from "zod";
import { userIdentitySchema } from "./user";

const bountyEventTypeEnumSchema = z.enum([
  "created",
  "completed",
  "cancelled",
  "hunt_started",
  "hunt_ended",
]);

export const bountyEventSchema = z.object({
  type: bountyEventTypeEnumSchema,
  timestamp: z.iso.datetime(),
  bountyId: z.uuid(),
  creator: userIdentitySchema.nullable(),
  winner: userIdentitySchema.nullable(),
});

export type BountyEvent = z.infer<typeof bountyEventSchema>;
