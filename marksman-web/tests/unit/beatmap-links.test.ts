import assert from "node:assert/strict";
import { test } from "node:test";
import { getBeatmapDownloadUrl } from "../../src/lib/beatmap-links";
import { linkedBeatmap } from "../fixtures/beatmap-links";

test("download uses the set ID rather than difficulty ID", () => {
  assert.equal(getBeatmapDownloadUrl(linkedBeatmap), "https://osu.ppy.sh/beatmapsets/987/download");
});
test("legacy difficulty URLs can recover set IDs from official cover metadata", () => {
  assert.equal(getBeatmapDownloadUrl({ ...linkedBeatmap,
    url: "https://osu.ppy.sh/beatmaps/42",
    covers: { cover: "https://assets.ppy.sh/beatmaps/654/covers/cover.jpg", card: "https://assets.ppy.sh/beatmaps/654/covers/card.jpg" },
  }), "https://osu.ppy.sh/beatmapsets/654/download");
});
test("missing set data does not mistake the difficulty ID for the set ID", () => {
  assert.equal(getBeatmapDownloadUrl(null), null);
  assert.equal(getBeatmapDownloadUrl({ ...linkedBeatmap, url: "https://osu.ppy.sh/beatmaps/42" }), null);
});
test("malformed, unexpected and nonpositive set URLs are ignored", () => {
  for (const url of ["invalid", "https://evil.example/beatmapsets/987", "https://osu.ppy.sh.evil.example/beatmapsets/987", "https://osu.ppy.sh/beatmapsets/0", "https://osu.ppy.sh/beatmapsets/-1", "https://osu.ppy.sh/beatmapsets/987oops", "http://osu.ppy.sh/beatmapsets/987"]) {
    assert.equal(getBeatmapDownloadUrl({ ...linkedBeatmap, url }), null);
  }
});
