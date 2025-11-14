"use server";

import { v2 } from "osu-api-extended";
import { osuAuth } from "./auth";
import { beatmaps_details_set_response } from "osu-api-extended/dist/types/v2/beatmaps_details_set";
import { SearchBeatmaps } from "osu-api-extended/dist/types/v2/search_all";

/**
 * Fetches beatmapset details using the osu! API v2.
 * @param id The beatmapset id to be looked up.
 * @returns A promise of a {@link https://github.com/cyperdark/osu-api-extended/wiki/v2.beatmaps.details_v3#types-for-type-set | beatmap details object}.
 */
export async function fetchBeatmapsetDetails(id: number) {
  return new Promise<beatmaps_details_set_response>(async (resolve, reject) => {
    await osuAuth();
    const result = await v2.beatmaps.details({
      type: "set",
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

/**
 * Fetches beatmaps from a provided search querry using the osu! API v2.
 * @param querry A string search querry to be looked.
 * @returns A promise of a {@link https://github.com/cyperdark/osu-api-extended/wiki/v2.search_v3#types-for-type-beatmaps | SearchBeatmaps object}.
 */
export async function fetchSearchBeatmapset(querry: string) {
  return new Promise<SearchBeatmaps>(async (resolve, reject) => {
    await osuAuth();
    const result = await v2.search({
      type: "beatmaps",
      query: querry,
      mode: "osu",
      status: "any",
    });
    if (result.error != null) {
      console.log(result.error);
      reject();
    } else {
      resolve(result);
    }
  });
}
