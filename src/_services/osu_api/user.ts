"use server";

import { v2 } from "osu-api-extended";
import { osuAuth } from "./auth";
import { UsersDetailsResponse } from "osu-api-extended/dist/types/v2/users_details";

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
