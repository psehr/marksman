import { huntSchema } from "@marksman/contracts";
import { apiFetch } from "./client";

export async function getOngoingHunts(signal?: AbortSignal) {
  return huntSchema.array().parse(await apiFetch("/users/me/hunts", { signal }));
}

export async function startHunt(bountyId: string) {
  return huntSchema.parse(await apiFetch(`/bounties/${encodeURIComponent(bountyId)}/hunt`, {
    method: "POST",
  }));
}

export async function stopHunt(huntId: string) {
  return huntSchema.parse(await apiFetch(`/hunts/${encodeURIComponent(huntId)}/stop`, {
    method: "POST",
  }));
}
