"use client";

import { Bounty } from "@models/bounty";
import { BeatmapSet, BeatmapVersion } from "@models/beatmap";
import Image from "next/image";
import { shortener } from "@/src/_utils/strings";
import { statusBgColor, StatusPill } from "./status_pill";
import InlineUser from "../user/inline";
import { gold_to_experience } from "@/src/_utils/maths";
import { DifficultyCircle, difficultyColors } from "./difficulty_circle";
import ModList from "../mods/mod_list";
import { formatDistanceStrict } from "date-fns";
import BountyTypePill, { bountyTypeColors } from "../bounty/type_pill";
import { useEffect, useState } from "react";
import { VersionPill } from "./version_pill";
import { BountyRewardPill } from "../bounty/reward_pill";
import { rewardTierColors, RewardTierPill } from "../bounty/reward_tier_pill";

export function BeatmapCard({
  beatmapset,
  bounty,
  simplified,
}: {
  beatmapset: BeatmapSet;
  bounty?: Bounty;
  simplified?: boolean;
}) {
  const title = shortener(beatmapset.metadata.title, 45);
  const artist = shortener(beatmapset.metadata.artist, 20);
  let diffname = "";
  let difficulty_border_color = "";
  let border_color;
  let difficulty_bg_color = "";

  const [timeDiff, setTimeDiff] = useState<string>("");

  let xp = "0";
  if (bounty) {
    border_color = rewardTierColors(bounty.tier).border_color;

    setInterval(() => {
      setTimeDiff(formatDistanceStrict(Date.now(), bounty.timestamp));
    }, 1000);
  }

  useEffect(() => {
    if (bounty) setTimeDiff(formatDistanceStrict(Date.now(), bounty.timestamp));
  }, []);

  return (
    <div
      className={`
        relative flex w-full h-full place-content-center items-center overflow-x-hidden rounded-xl sm:rounded-3xl font-extrabold shadow-lg text-nowrap border ${border_color} hover:scale-[101%] transition-all duration-[50ms] cursor-pointer text-[2vw] sm:text-sm
        `}
    >
      <div className="relative flex  w-full h-full">
        <Image src={beatmapset.slimcover} alt="" width={1800} height={500} />{" "}
        <div className="absolute bg-black/60 flex w-full h-full"></div>
      </div>

      <div className="absolute flex flex-col w-full h-full space-y-1.5 sm:space-y-3 place-content-center">
        <div className="flex flex-row w-full h-1/5 place-content-center items-center space-x-2">
          {!simplified ? (
            <div className="flex place-content-center items-center w-fit h-full min-w-32 bg-black/50 p-2 px-4 rounded-xl border border-white/50">
              <p className="text-center text-sm">{artist}</p>
            </div>
          ) : null}

          {bounty ? <VersionPill version={bounty.version} /> : null}
          {!simplified ? (
            <div
              className={`flex flex-row w-fit h-full items-center bg-black/50 p-2 px-4 rounded-xl space-x-4 border border-white/50 text-sm`}
            >
              <InlineUser user={beatmapset.creator} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-row w-full h-1/4 place-content-center items-center">
          <div className="flex w-fit min-w-64 h-fit place-content-center items-center bg-black/60 px-4 rounded-xl border border-white/50">
            <p className="text-center text-xs sm:text-lg">{title}</p>
          </div>
        </div>

        {bounty ? (
          <div className="flex flex-row w-full h-1/5 place-content-center items-center space-x-2">
            {bounty.required_mods.length ? (
              <div className="flex flex-row h-full bg-yellow-800/50 p-1 px-4 rounded-xl place-content-center items-center border border-yellow-400">
                <ModList
                  mods={bounty.required_mods}
                  direction="row"
                  width="w-4 sm:w-7"
                />
              </div>
            ) : null}
            <BountyRewardPill bounty={bounty} />
          </div>
        ) : null}
      </div>
      <div className="absolute flex w-full h-full text-xs sm:text-sm">
        {bounty ? (
          <>
            <div className="absolute bottom-1 sm:bottom-3 right-1 sm:right-3">
              <InlineUser user={bounty?.creator} />
            </div>
            <div className="absolute bottom-1 sm:bottom-3 left-1 sm:left-3 text-[2vw] sm:text-xs">
              <p>{timeDiff} ago</p>
            </div>
            <div className="absolute top-1 sm:top-3 left-1 sm:left-3">
              <BountyTypePill type={bounty.type} />
            </div>
          </>
        ) : null}
        <div className="absolute top-1 sm:top-3 right-1 sm:right-3">
          {bounty ? <RewardTierPill tier={bounty?.tier} /> : null}
        </div>
      </div>
    </div>
  );
}
