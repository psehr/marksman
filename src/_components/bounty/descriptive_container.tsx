import { Bounty } from "@/src/_models/bounty";
import { BeatmapSlim } from "../beatmap/beatmap_slim";
import { VersionPill } from "../beatmap/version_pill";
import { TbStarFilled, TbInfoCircle } from "react-icons/tb";
import ModList from "../mods/mod_list";
import { BountyRewardPill } from "./reward_pill";
import { RewardTierFromRewardGold, RewardTierPill } from "./reward_tier_pill";
import { formatDistanceStrict } from "date-fns";
import InlineUser from "../user/inline";
import BountyTypePill from "./type_pill";
import { ReactNode } from "react";
import { gold_to_experience } from "@/src/_utils/maths";

export function BountyPropertyBarContainer({
  children,
  title,
  color,
}: {
  children: ReactNode;
  title: string;
  color: "blue" | "green" | "red";
}) {
  let bg_color = "";
  let bg_color2 = "";
  switch (color) {
    case "blue":
      bg_color = "bg-blue-600";
      bg_color2 = "bg-blue-600/50";
      break;
    case "green":
      bg_color = "bg-green-700";
      bg_color2 = "bg-green-700/50";
      break;
    case "red":
      bg_color = "bg-red-400";
      bg_color2 = "bg-red-500/50";
      break;
  }
  return (
    <div className="relative flex flex-row w-full h-8 items-center">
      <div
        className={`absolute z-10 h-full w-fit ${bg_color} rounded-xl flex items-center`}
      >
        <p
          className={`select-none text-[2vw] md:text-xs font-extrabold rounded-full md:p-1 px-1 md:px-3 h-fit min-w-24 text-center`}
        >
          {title}
        </p>
      </div>
      <div
        className={`${bg_color2} absolute w-full z-0 px-2 rounded-full h-full flex place-content-end items-center space-x-2`}
      >
        {children}
      </div>
    </div>
  );
}

export function BountyDescriptiveContainer({
  bounty,
  children,
}: {
  bounty: Bounty;
  children?: ReactNode;
}) {
  const desc_fc = "Obtain an FC";
  const desc_clear = "Clear without dying";
  const desc_reward = "Reward on completion:";

  let desc_type = "";
  switch (bounty.type) {
    case "FC":
      desc_type = desc_fc;
      break;
    case "Clear":
      desc_type = desc_clear;
      break;
  }

  const color = bounty.type == "FC" ? "green" : "blue";
  const container_colors = {
    bg_color: bounty.type == "FC" ? "bg-green-950" : "bg-blue-950",
    border_color:
      bounty.type == "FC" ? "border-green-800/50" : "border-blue-800/50",
  };

  return (
    <div className="w-full h-fit flex flex-col space-y-4">
      <div
        className={`w-full h-fit ${container_colors.bg_color} ${container_colors.border_color} border-2 shadow-lg p-4 rounded-xl space-y-1`}
      >
        <div className="mb-6">
          <BeatmapSlim
            beatmapset={bounty.beatmapset}
            simplified
            clickAction={() => window.open(bounty.beatmapset.url)}
          />
        </div>
        {bounty.type != "Any" ? (
          <BountyPropertyBarContainer color={color} title="Your goal">
            <p>{desc_type}</p>
          </BountyPropertyBarContainer>
        ) : null}
        {bounty.required_mods.length ? (
          <BountyPropertyBarContainer color={color} title="Must use">
            <ModList mods={bounty.required_mods} direction="row" width="w-8" />
          </BountyPropertyBarContainer>
        ) : null}
        {bounty.disallowed_mods.length ? (
          <BountyPropertyBarContainer color={color} title="Can't use">
            <ModList
              mods={bounty.disallowed_mods}
              direction="row"
              width="w-8"
            />
          </BountyPropertyBarContainer>
        ) : null}
        {bounty.type == "FC" ? (
          <BountyPropertyBarContainer color={color} title="Min. combo">
            <p>
              {bounty.version.attributes.max_combo - bounty.sliderend_leniency}/
              {bounty.version.attributes.max_combo}
            </p>
          </BountyPropertyBarContainer>
        ) : null}
        {bounty.reward > 0 ? (
          <div className="pt-8 flex flex-col space-y-1">
            <BountyPropertyBarContainer color={color} title="Tier">
              <RewardTierPill tier={bounty.tier} />
            </BountyPropertyBarContainer>
            <BountyPropertyBarContainer color={color} title="Reward">
              🪙 {bounty.reward.toLocaleString("en-US")}
            </BountyPropertyBarContainer>
            <BountyPropertyBarContainer color={color} title="XP">
              🎮{" "}
              {gold_to_experience(
                bounty.reward,
                Math.floor((Date.now() - bounty.timestamp) / 1000 / 86400)
              ).toLocaleString("en-US")}
            </BountyPropertyBarContainer>
          </div>
        ) : null}

        {bounty.version.id != 0 ? (
          <div className="pt-8">
            <div className="flex flex-row w-full h-fit place-content-center items-center space-x-2">
              <div className="w-fit h-fit">
                <VersionPill version={bounty.version} />
              </div>

              <p className="flex flex-row items-center">by</p>
              <InlineUser
                user={bounty.beatmapset.creator}
                noAvatar
              ></InlineUser>
            </div>
          </div>
        ) : null}
      </div>
      {children}
      <div
        className={`flex flex-col w-full h-fit ${container_colors.bg_color} ${container_colors.border_color} border-2 p-4 rounded-xl shadow-lg space-y-4 place-content-center items-center`}
      >
        <div className="flex flex-row place-content-between w-full">
          <div className="flex flex-row space-x-2">
            <p>Initiated by</p>
            <InlineUser
              user={{
                id: 9239673,
                name: "pseh",
                image: "https://a.ppy.sh/9239673?1729549056.jpeg",
                country_code: "FR",
              }}
            />
          </div>
          {bounty.timestamp != 0 ? (
            <p>{formatDistanceStrict(Date.now(), bounty.timestamp)} ago</p>
          ) : null}
        </div>
        {bounty.title ? (
          <div className="flex flex-row place-content-start items-start w-full">
            <p className="text-sm text-gray-400 italic">{bounty.title}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
