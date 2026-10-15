import { z } from "zod";

export const huntStatusEnum = z.enum(["ongoing", "stopped", "closed"]);

export const huntSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  bountyId: z.uuid(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  status: huntStatusEnum,
});

export type Hunt = z.infer<typeof huntSchema>;
