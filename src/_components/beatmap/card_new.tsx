import { BeatmapSet, BeatmapVersion } from "@/src/_models/beatmap";
import { shortener } from "@/src/_utils/strings";
import { Anonymous_Pro } from "next/font/google";
import Image from "next/image";
import { DifficultyCircle } from "./difficulty_circle";
import { ModList } from "@/src/app/tests/bounty/BountyCard";
import { Mod } from "@/src/_models/score";

const anonymous = Anonymous_Pro({ weight: "700", subsets: ["latin"] });

export default function BeatmapCardNew(props: {
  beatmapset: BeatmapSet;
  version?: BeatmapVersion;
  required_mods?: Mod[];
  invalid_mods?: Mod[];
}) {
  let title_size = "text-md md:text-2xl lg:text-3xl";
  let field_size = "text-sm md:text-xl lg:text-xl";

  return (
    <div
      className={
        "size-full relative flex flex-row text-nowrap place-content-between rounded-2xl shadow-md " +
        anonymous.className
      }
    >
      {/* Background Cover */}
      <div className="absolute z-0 size-full overflow-hidden rounded-2xl">
        <div className="relative size-full">
          <Image
            src={props.beatmapset.cover}
            alt="cover"
            fill
            objectFit="cover"
          />
        </div>
      </div>
      {/* Background Dark Filter */}
      <div className="absolute z-0 size-full rounded-2xl bg-black/50"></div>

      <div className="flex flex-row place-content-between items-center w-full h-full px-4 p-2">
        {/* Metadata Left Container */}
        <div
          className={
            "z-10 flex flex-col h-fit w-3/4 overflow-hidden space-y-2 mr-2"
          }
        >
          {/* Title */}
          <p className={"text-white/80 select-none " + title_size}>
            {shortener(props.beatmapset.metadata.title, 30)}
          </p>
          {/* Artist */}
          <p className={"text-white/40 italic select-none " + field_size}>
            {shortener(props.beatmapset.metadata.artist, 30)}
          </p>
        </div>
        {/* Metadata Right Container */}
        <div className={"z-10 flex flex-col h-fit w-fit items-end space-y-2"}>
          {/* Modlist */}
          <div className={"flex h-1/2 min-h-6 gap-4 items-center"}>
            {props.required_mods?.length ? (
              <ModList mods={props.required_mods} strikethrough={false} />
            ) : null}

            {/* Difficulty name */}
            <p className="hidden lg:flex">
              [ {shortener(props.version?.difficulty_name!, 15)} ]
            </p>
          </div>
          <div className="flex h-1/2 min-h-6">
            {/* Mapper */}
            <p
              className={
                "hidden lg:flex text-white/40 select-none " + field_size
              }
            >
              {props.beatmapset.creator.name}
            </p>
            <div className="flex lg:hidden">
              {props.invalid_mods?.length ? (
                <ModList mods={props.invalid_mods} strikethrough />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
