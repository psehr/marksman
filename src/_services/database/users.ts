import { MarksmanUser } from "@/src/_models/user";
const API_URL = "http://localhost:3000/api";

/**
 * Fetches a user from the API using its user_id.
 * @param user_id The user_id to be looked up.
 * @returns A promise containg a new {@link MarksmanUser}
 */
export async function fetchUser(user_id: string) {
  const baseRoute = API_URL + "/users";

  return new Promise<MarksmanUser>(async (resolve, reject) => {
    const userData = await fetch(baseRoute + "/" + user_id);
    if (userData.status == 200)
      resolve((await userData.json()) as MarksmanUser);
  });
}
