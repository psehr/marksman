import { z } from "zod";

export const ledgerEntryReasonSchema = z.enum([
  "bounty_funding",
  "bounty_fee",
  "bounty_refund",
  "bounty_reward",
  "initial_grant",
  "daily_claim",
]);

export const ledgerEntrySchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  amount: z.number().int(),
  reason: ledgerEntryReasonSchema,
  bountyId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type LedgerEntryReason = z.infer<typeof ledgerEntryReasonSchema>;
