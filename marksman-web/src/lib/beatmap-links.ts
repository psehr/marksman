import type { BountyBeatmapMetadata } from "@marksman/contracts";

/** Older stored metadata has no explicit set ID; use official URLs only. */
export function getBeatmapDownloadUrl(beatmap: BountyBeatmapMetadata | null): string | null {
  if (!beatmap) return null;
  for (const value of [beatmap.url, beatmap.covers?.cover, beatmap.covers?.card]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") continue;
      const match = url.hostname === "osu.ppy.sh"
        ? /^\/beatmapsets\/([1-9]\d*)(?:\/|$)/.exec(url.pathname)
        : url.hostname === "assets.ppy.sh"
          ? /^\/beatmaps\/([1-9]\d*)\/covers\//.exec(url.pathname)
          : null;
      if (match) return `https://osu.ppy.sh/beatmapsets/${match[1]}/download`;
    } catch {
      // Missing/malformed historical metadata must not break the detail page.
    }
  }
  return null;
}
