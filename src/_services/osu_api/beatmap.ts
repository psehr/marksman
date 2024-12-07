"use server";

import { v2 } from "osu-api-extended";
import { osuAuth } from "./auth";

export async function fetchBeatmapsetDetails(id: number) {
  return new Promise(async (resolve, reject) => {
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

export async function fetchSearchBeatmapset(querry: string) {
  return new Promise(async (resolve, reject) => {
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
