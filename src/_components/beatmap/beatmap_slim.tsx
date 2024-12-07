import { BeatmapSet } from "@/src/_models/beatmap";
import { Bounty } from "@/src/_models/bounty";
import { gold_to_experience } from "@/src/_utils/maths";
import { shortener } from "@/src/_utils/strings";
import { useEffect, useState } from "react";
import { DifficultyCircle, difficultyColors } from "./difficulty_circle";
import BountyTypePill, { bountyTypeColors } from "../bounty/type_pill";
import { formatDistanceStrict } from "date-fns";
import Image from "next/image";
import ModList from "../mods/mod_list";
import { StatusPill } from "./status_pill";
import InlineUser from "../user/inline";
import { BountyRewardPill } from "../bounty/reward_pill";
import { VersionPill } from "./version_pill";
import { rewardTierColors, RewardTierPill } from "../bounty/reward_tier_pill";

export function BeatmapSlim({
  beatmapset,
  bounty,
  simplified,
  clickAction,
  selected,
  maxLength,
}: {
  beatmapset: BeatmapSet;
  bounty?: Bounty;
  simplified?: boolean;
  clickAction?: any;
  selected?: boolean;
  maxLength?: number;
}) {
  const title = shortener(
    beatmapset.metadata.title,
    maxLength ? maxLength : 40
  );
  const artist = shortener(beatmapset.metadata.artist, 20);
  let diffname = "";
  let difficulty_border_color = "";
  let border_color;
  let difficulty_bg_color = "";

  const [timeDiff, setTimeDiff] = useState<string>("");
  const [hover, setHover] = useState(false);

  let xp = "0";
  let gold_reward_str = "0";

  if (bounty) {
    const gold_reward = bounty.reward;
    gold_reward_str = gold_reward.toLocaleString("en-US");
    const days_elapsed = Math.floor(
      (Date.now() - bounty.timestamp) / 1000 / 86400
    );
    xp = gold_to_experience(gold_reward, days_elapsed).toLocaleString("en-US");

    diffname = shortener(bounty.version.difficulty_name, 30);
    difficulty_border_color = difficultyColors(
      bounty.version.attributes.star_rating
    ).border_color;
    difficulty_bg_color = difficultyColors(
      bounty.version.attributes.star_rating
    ).bg_color;
    border_color = "border " + rewardTierColors(bounty.tier).border_color;

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
    relative flex w-full h-12 place-content-center items-center overflow-hidden rounded-xl sm:rounded-3xl font-extrabold text-nowrap ${
      selected ? "border-2 border-green-400" : ""
    } ${border_color} hover:scale-[101%] transition-all duration-[50ms] cursor-pointer text-[2vw] sm:text-sm shadow-lg
    `}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={clickAction}
    >
      <div className="relative flex w-full h-full">
        <Image
          src={beatmapset.slimcover}
          alt=""
          width={1800}
          height={500}
          style={{ objectFit: "cover" }}
        />{" "}
        <div className="absolute bg-black/60 flex w-full h-full"></div>
      </div>
      <div className="absolute flex flex-row w-full h-full place-content-center items-center">
        {hover ? (
          bounty ? (
            <div className="absolute left-4 flex flex-row space-x-4">
              <p>{timeDiff} ago</p>
            </div>
          ) : null
        ) : (
          <div className="absolute left-2 flex flex-row space-x-2 items-center">
            {bounty ? <BountyTypePill type={bounty?.type} /> : null}
            {bounty?.required_mods.length ? (
              <ModList
                mods={bounty.required_mods}
                direction="row"
                width="w-4 sm:w-7"
              />
            ) : null}
          </div>
        )}
        <div className="absolute left-2 flex flex-row space-x-4">
          {!simplified && !bounty ? (
            <InlineUser user={beatmapset.creator} noAvatar />
          ) : null}
        </div>

        <div className="w-fit flex flex-row space-x-2">
          {hover && bounty ? (
            <VersionPill version={bounty.version} />
          ) : (
            <p>{title}</p>
          )}
        </div>
        {!simplified ? (
          <div className="absolute right-2 flex flex-row space-x-4">
            {bounty ? (
              hover ? (
                <InlineUser user={bounty.creator} />
              ) : (
                <div className="flex flex-row space-x-2 items-center">
                  {bounty ? <RewardTierPill tier={bounty?.tier} /> : null}

                  <BountyRewardPill bounty={bounty} />
                </div>
              )
            ) : (
              <StatusPill status={beatmapset.status} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
