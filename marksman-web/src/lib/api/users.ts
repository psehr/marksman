import {
  bountyEventSchema,
  ledgerEntrySchema,
  userSchema,
} from "@marksman/contracts";
import { apiFetch } from "./client";

export async function getCurrentUser() {
  return userSchema.parse(
    await apiFetch(`/auth/me`, {
      method: "GET",
    }),
  );
}

export async function getUser(id: string) {
  return userSchema.parse(await apiFetch(`/users/${encodeURIComponent(id)}`));
}

export async function getUserLedger(page: number) {
  return ledgerEntrySchema
    .array()
    .parse(await apiFetch(`/users/me/ledger?page=${page}`));
}

export async function getUserBountyEvents(id: string, page: number) {
  return bountyEventSchema.array().parse(
    await apiFetch(`/users/${encodeURIComponent(id)}/bounty-events?page=${page}`),
  );
}
