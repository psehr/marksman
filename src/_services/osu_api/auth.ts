import { auth, v2 } from "osu-api-extended";

/**
 * Tries to authenticate to the public osu! API v2 using the local environment variables for OSU_CLIENT_ID and OSU_CLIENT_SECRET.
 */
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
