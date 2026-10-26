import { bountySchema, extendedBountySchema } from "@marksman/contracts";
import { apiFetch } from "./client";
import { z } from "zod";

export async function cancelBounty(bountyId: string) {
  return z.object({ bounty: bountySchema }).parse(await apiFetch(`/bounties/${encodeURIComponent(bountyId)}/cancel`, { method: "POST" })).bounty;
}

export async function setBountyBookmark(bountyId: string, bookmarked: boolean) {
  await apiFetch(`/bounties/${encodeURIComponent(bountyId)}/${bookmarked ? "bookmark" : "unbookmark"}`, { method: "POST" });
}

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
