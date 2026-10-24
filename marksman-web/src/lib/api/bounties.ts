import { extendedBountySchema } from "@marksman/contracts";
import { apiFetch } from "./client";

export async function getBounty(bountyId: string) {
  return extendedBountySchema.parse(
    await apiFetch(`/bounties/${encodeURIComponent(bountyId)}`, {
      method: "GET",
    }),
  );
}
