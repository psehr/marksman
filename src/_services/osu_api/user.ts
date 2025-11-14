"use server";

import { v2 } from "osu-api-extended";
import { osuAuth } from "./auth";
import { UsersDetailsResponse } from "osu-api-extended/dist/types/v2/users_details";

/**
 * Fetches an osu! user using its id from the osu! API v2.
 * @param id The user_id to be looked up.
 * @returns A promise of a {@link https://github.com/cyperdark/osu-api-extended/wiki/v2.users.details_v3#response | UsersDetailsResponse object}.
 */
export async function fetchOsuUser(id: string) {
  return new Promise<UsersDetailsResponse>(async (resolve, reject) => {
    await osuAuth();
    const result = await v2.users.details({
      mode: "osu",
      user: id,
    });
    if (result.error != null) {
      console.log(result.error);
      reject();
    } else {
      resolve(result);
    }
  });
}
