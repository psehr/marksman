import { z } from "zod";
import { config } from "../../config";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
});

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let cachedTokenRequest: Promise<string> | null = null;

export async function exchangeCodeForToken(code: string): Promise<string> {
  try {
    const response = await fetch("https://osu.ppy.sh/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.OSU_CLIENT_ID,
        client_secret: config.OSU_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.OSU_REDIRECT_URI,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error("Token request rejected");
    }

    const token = tokenResponseSchema.parse(await response.json());
    return token.access_token;
  } catch {
    throw new Error("Unable to exchange osu! authorization code");
  }
}

export async function getOsuAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken !== null && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  if (cachedTokenRequest !== null) {
    return cachedTokenRequest;
  }

  cachedTokenRequest = requestOsuAccessToken().finally(() => {
    cachedTokenRequest = null;
  });

  return cachedTokenRequest;
}

async function requestOsuAccessToken(): Promise<string> {
  const requestStartedAt = Date.now();

  try {
    const response = await fetch("https://osu.ppy.sh/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.OSU_CLIENT_ID,
        client_secret: config.OSU_CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "public",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error("Token request rejected");
    }

    const token = tokenResponseSchema.parse(await response.json());

    cachedToken = token.access_token;
    tokenExpiresAt = requestStartedAt + token.expires_in * 1000;

    return cachedToken;
  } catch {
    throw new Error("Unable to get an osu! access token");
  }
}
