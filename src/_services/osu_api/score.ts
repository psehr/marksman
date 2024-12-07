"use server";

import { v2 } from "osu-api-extended";
import { osuAuth } from "./auth";

export async function fetchScoreDetails(id: number) {
  return new Promise(async (resolve, reject) => {
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
