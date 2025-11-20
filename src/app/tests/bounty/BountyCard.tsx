import BeatmapCardNew from "@/src/_components/beatmap/card_new";
import Loading from "@/src/_components/loading";
import ModIcon from "@/src/_components/mods/mod_icon";
import ModIconNew from "@/src/_components/mods/mod_icon_new";
import { Bounty } from "@/src/_models/bounty";
import { ContainerSize } from "@/src/_models/containers";
import { Mod } from "@/src/_models/score";
import { formatDistanceStrict } from "date-fns";
import { Lexend_Deca } from "next/font/google";
import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";
import {
  TbPin,
  TbPinFilled,
  TbLink,
  TbX,
  TbArrowBigRightFilled,
  TbHeart,
  TbHeartFilled,
} from "react-icons/tb";

const lexend = Lexend_Deca({ subsets: ["latin"] });

export default function BountyCardNew(props: {
  bounty: Bounty;
  claimAction?: Function;
  pinAction?: Function;
  shareAction: Function;
  heartAction: Function;
  pinned: boolean;
  claiming: boolean;
  hearted: boolean;
}) {
  const [timeDiff, setTimeDiff] = useState<string>("");

  useEffect(() => {
    if (props.bounty)
      setTimeDiff(formatDistanceStrict(Date.now(), props.bounty.timestamp));
  }, []);

  const containerVisuals =
    " border border-white/5 hover:brightness-110 transition-all cursor-pointer shadow-md rounded-lg";

  return (
    <div
      className={
        "relative flex flex-row w-full h-fit overflow-hidden items-center group " +
        containerVisuals
      }
    >
      {/* Background Cover */}
      <div className="absolute z-0 size-full saturate-0 group-hover:saturate-100 transition-all">
        <Image
          src={props.bounty.beatmapset.cover}
          alt="cover"
          fill
          objectFit="cover"
        />
      </div>
      {/* Background dark Filter */}
      <div className="absolute z-0 size-full bg-black/80"></div>
      {/* Background blur filter */}
      {/* <div className="absolute z-0 size-full backdrop-blur-sm"></div> */}
      {/* Bounty Container */}
      <div className="z-10 flex flex-col size-full gap-2 p-2">
        {/* Beatmap Card */}
        <div className="flex w-full min-h-16 h-1/4 lg:h-1/2">
          <BeatmapCardNew
            beatmapset={props.bounty.beatmapset}
            version={props.bounty.version}
            required_mods={props.bounty.required_mods}
            invalid_mods={props.bounty.disallowed_mods}
          />
        </div>
        {/* Bottom container */}
        <div
          className={
            "flex flex-col h-fit gap-8 place-content-between lg:p-0 lg:flex-row " +
            lexend.className
          }
        >
          {/* Bounty characteristics (tier & type) */}
          <div className="space-y-1 h-fit lg:flex lg:w-1/2 lg:space-y-0 lg:gap-2">
            <div className="h-8 lg:w-1/3">
              <BountyTierCard bounty={props.bounty} />
            </div>
            <div className="h-8 lg:w-1/3">
              <BountyTypeCard bounty={props.bounty} />
            </div>
            <div className="hidden lg:flex h-8 lg:w-1/3 gap-1">
              <ModList mods={props.bounty.disallowed_mods} strikethrough />
            </div>
          </div>
          <div className="h-8 flex flex-row place-content-between space-x-4 lg:w-1/2 lg:place-content-end">
            {/* Bottom buttons (shown on mobile) */}
            <div className="flex z-10 flex-row h-8 w-1/2 gap-1 lg:h-full lg:place-content-end">
              <div className="size-8">
                <Button
                  type="secondary"
                  action={() => {
                    props.heartAction();
                  }}
                  content={
                    props.hearted ? (
                      <TbHeartFilled className="size-8 p-1" />
                    ) : (
                      <TbHeart className="size-8 p-1" />
                    )
                  }
                />
              </div>
              <div className="size-8">
                <Button
                  type="secondary"
                  action={() => {
                    props.pinAction!();
                  }}
                  content={
                    props.pinned ? (
                      <TbPinFilled className="size-8 p-1" />
                    ) : (
                      <TbPin className="size-8 p-1" />
                    )
                  }
                />
              </div>
              <div className="size-8">
                <Button
                  type="secondary"
                  action={() => {}}
                  content={<TbLink className="size-8 p-1" />}
                />
              </div>
            </div>
            {/* Claim button */}
            <div className="w-1/2 lg:w-1/3">
              <Button
                type="validation"
                content={
                  <div className="size-full flex flex-row space-x-2 items-center place-content-center">
                    {props.claiming ? (
                      <Loading size={32} />
                    ) : (
                      <>
                        <p>Claim</p>
                        <TbArrowBigRightFilled size={16} />
                      </>
                    )}
                  </div>
                }
                action={() => props.claimAction!()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export function ModList(props: { mods: Mod[]; strikethrough: boolean }) {
  let modList: ReactNode[] = [];

  props.mods.forEach((mod) => {
    modList.push(
      <div
        className="relative flex place-content-center items-center"
        key={mod}
      >
        <ModIconNew mod={mod} sizes="size-6 lg:size-8" key={mod} />
        {props.strikethrough ? (
          <TbX className="absolute size-[110%] stroke-red-600/70" />
        ) : null}
      </div>
    );
  });

  return <div className="flex gap-1">{modList}</div>;
}

export function BountyTypeCard(props: { bounty: Bounty }) {
  let content;
  switch (props.bounty.type) {
    case "Clear":
      content = (
        <div className="absolute size-full flex place-content-center items-center border border-green-800/50 rounded-lg overflow-hidden">
          <p className="absolute z-10">Clear the map</p>
          <div className="absolute z-0 size-full bg-gradient-to-br from-green-800/50 to-green-800 opacity-30"></div>
        </div>
      );
      break;
    case "FC":
      content = (
        <div className="absolute size-full flex place-content-center items-center border border-sky-800/50 rounded-lg overflow-hidden">
          <p className="absolute z-10">Obtain an FC</p>
          <div className="absolute z-0 size-full bg-gradient-to-br from-sky-800/50 to-sky-800 opacity-30"></div>
        </div>
      );
      break;
  }

  return (
    <div className="relative flex flex-row size-full place-content-center items-center text-nowrap">
      {content}
    </div>
  );
}

export function BountyTierCard(props: { bounty: Bounty }) {
  let content;
  switch (props.bounty.tier) {
    case "Common":
      content = (
        <div className="absolute size-full flex place-content-center items-center border border-white/50 rounded-lg overflow-hidden">
          <p className="absolute z-10">Common</p>
          <div className="absolute z-0 size-full bg-gradient-to-br from-white/50 to-white opacity-30"></div>
        </div>
      );
      break;
    case "Uncommon":
      content = (
        <div className="absolute size-full flex place-content-center items-center border border-green-700/50 rounded-lg overflow-hidden">
          <p className="absolute z-10">Uncommon</p>
          <div className="absolute z-0 size-full bg-gradient-to-br from-green-700/50 to-green-700 opacity-30"></div>
        </div>
      );
      break;
    case "Rare":
      content = (
        <div className="absolute size-full flex place-content-center items-center border border-blue-700/50 rounded-lg overflow-hidden">
          <p className="absolute z-10">Rare</p>
          <div className="absolute z-0 size-full bg-gradient-to-br from-blue-700/50 to-blue-700 opacity-30"></div>
        </div>
      );
      break;
    case "Epic":
      content = (
        <div className="absolute size-full flex place-content-center items-center border border-purple-700/50 rounded-lg overflow-hidden">
          <p className="absolute z-10">Epic</p>
          <div className="absolute z-0 size-full bg-gradient-to-br from-purple-700/50 to-purple-700 opacity-30"></div>
        </div>
      );
      break;
    case "Mythic":
      content = (
        <div className="absolute size-full flex place-content-center items-center border border-red-700/50 rounded-lg overflow-hidden">
          <p className="absolute z-10">Mythic</p>
          <div className="absolute z-0 size-full bg-gradient-to-br from-red-700/50 to-red-700 opacity-30"></div>
        </div>
      );
      break;
    default:
      break;
  }

  return (
    <div className="relative flex flex-row size-full place-content-center items-center shadow-md">
      {content}
    </div>
  );
}

export function Button(props: {
  type: "primary" | "secondary" | "validation" | "cancellation" | "information";
  content: ReactNode;
  action: Function;
}) {
  let backgroundColorGradient;
  switch (props.type) {
    case "primary":
      backgroundColorGradient = "from-slate-400/70 to-slate-400/40";
      break;
    case "secondary":
      backgroundColorGradient = "from-slate-700/70 to-slate-700/40";

      break;
    case "validation":
      backgroundColorGradient = "from-green-400/70 to-green-400/40";
      break;
    case "cancellation":
      backgroundColorGradient = "from-red-600/70 to-red-600/40";
      break;
    case "information":
      backgroundColorGradient = "from-blue-600/70 to-blue-600/40";
      break;
  }

  return (
    <div
      className={
        "relative size-full flex place-content-center from-slate-700/70 items-center rounded-lg overflow-hidden cursor-pointer shadow-md hover:brightness-125 hover:saturate-150 transition-all duration-150"
      }
      onClick={() => props.action()}
    >
      <div className={"absolute z-10 font-medium px-2"}>{props.content}</div>
      <div
        className={
          "absolute z-0 size-full bg-gradient-to-br opacity-80 " +
          backgroundColorGradient
        }
      ></div>
    </div>
  );
}
