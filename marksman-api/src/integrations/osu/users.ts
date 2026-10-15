import { z } from "zod";

const osuProfileResponseSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1),
});

export type OsuProfileResponse = z.infer<typeof osuProfileResponseSchema>;

export async function fetchOwnOsuProfile(accessToken: string) {
  try {
    const response = await fetch("https://osu.ppy.sh/api/v2/me", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error("Profile request rejected");
    }

    return osuProfileResponseSchema.parse(await response.json());
  } catch {
    throw new Error("Unable to fetch osu! profile");
  }
}
