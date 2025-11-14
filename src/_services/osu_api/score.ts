"use server";

import { v2 } from "osu-api-extended";
import { osuAuth } from "./auth";
import { scores_details_response } from "osu-api-extended/dist/types/v2/scores_details";

/**
 * Fetches a score using its id from the osu! API v2.
 * @param id The score id to be looked up.
 * @returns A promise of a {@link https://github.com/cyperdark/osu-api-extended/wiki/v2.scores.details_v3#response | score details object}.
 */
export async function fetchScoreDetails(id: number) {
  return new Promise<scores_details_response>(async (resolve, reject) => {
    await osuAuth();
    const result = await v2.scores.details({
      id: id,
    });
    if (result.error != null) {
      console.log(result.error);
      reject();
    } else {
      resolve(result);
    }
  });
}
