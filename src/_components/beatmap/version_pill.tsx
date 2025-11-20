import { BeatmapVersion } from "@/src/_models/beatmap";
import { DifficultyCircle, difficultyColors } from "./difficulty_circle";
import { shortener } from "@/src/_utils/strings";

export function VersionPill({
  version,
  maxLength,
  selected,
}: {
  version: BeatmapVersion;
  maxLength?: number;
  selected?: boolean;
}) {
  const diffname = shortener(
    version.difficulty_name,
    maxLength ? maxLength : 30
  );
  const difficulty_border_color = selected
    ? "border-2 border-green-400"
    : difficultyColors(version.attributes.star_rating).border_color;
  const difficulty_bg_color = difficultyColors(
    version.attributes.star_rating
  ).bg_color;
  return (
    <div
      className={`text-center select-none flex shadow-lg flex-row h-full p-1 px-4 ${difficulty_bg_color} rounded-lg space-x-1 place-content-center items-center border ${difficulty_border_color}`}
    >
      <p className="sm:text-xs">{diffname}</p>
      <DifficultyCircle version={version} size={32} />
    </div>
  );
}
