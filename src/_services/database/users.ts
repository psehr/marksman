import { MarksmanUser } from "@/src/_models/user";
const API_URL = "http://localhost:3000/api";

export async function fetchUser(user_id: string) {
  const baseRoute = API_URL + "/users";

  return new Promise<MarksmanUser>(async (resolve, reject) => {
    const userData = await fetch(baseRoute + "/" + user_id);
    if (userData.status == 200)
      resolve((await userData.json()) as MarksmanUser);
  });
}
