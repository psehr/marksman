import type { BountyBeatmapMetadata } from "@marksman/contracts";

export const linkedBeatmap: BountyBeatmapMetadata = {
  url: "https://osu.ppy.sh/beatmapsets/987#osu/42",
  version: { id: 42, name: "Extra" },
  song: { title: "Link fixture", artist: "Fixture artist" },
  specs: { sr: 5, ar: 9, od: 8, cs: 4, hp: 6, bpm: 180, length: { total: 120, drain: 110 }, maxCombo: 1000 },
  covers: null, creator: null, stats: { status: "ranked", playcount: 100 },
};
