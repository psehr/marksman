import { extendedBountySchema } from "@marksman/contracts";
import { apiFetch } from "./client";

export async function getBounty(bountyId: string) {
  return extendedBountySchema.parse(
    await apiFetch(`/bounties/${encodeURIComponent(bountyId)}`, {
      method: "GET",
    }),
  );
}

export async function getAllBounties() {
  return extendedBountySchema
    .array()
    .parse(await apiFetch(`/bounties`, { method: "GET" }));
}

export async function getBookmarkedBounties() {
  return extendedBountySchema
    .array()
    .parse(await apiFetch(`/users/me/bookmarked-bounties`, { method: "GET" }));
}
