import { auth, v2 } from "osu-api-extended";

export async function osuAuth() {
  try {
    await auth.login({
      type: "v2",
      client_id: parseInt(process.env.OSU_CLIENT_ID || "0"),
      client_secret: process.env.OSU_CLIENT_SECRET || "",
      scopes: ["public"],
      cachedTokenPath: "./client.json",
    });
  } catch (error) {
    console.log(error);
  }
}
