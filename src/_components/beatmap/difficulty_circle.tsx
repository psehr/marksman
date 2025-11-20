"use client";

import { BeatmapVersion } from "@/src/_models/beatmap";
import Image from "next/image";
import { useState } from "react";
import { VersionPill } from "./version_pill";
import { propagateServerField } from "next/dist/server/lib/render-server";

export function difficultyColors(star_rating: number): {
  bg_color: string;
  border_color: string;
} {
  let bg_color = "bg-blue-800/50";
  let border_color = "border-blue-400";

  if (star_rating > 1.99) {
    bg_color = "bg-green-800/50";
    border_color = "border-green-400";
  }
  if (star_rating > 2.69) {
    bg_color = "bg-yellow-800/50";
    border_color = "border-yellow-400";
  }
  if (star_rating > 3.99) {
    bg_color = "bg-orange-800/50";
    border_color = "border-orange-400";
  }
  if (star_rating > 5) {
    bg_color = "bg-pink-800/50";
    border_color = "border-pink-400";
  }
  if (star_rating > 6.49) {
    bg_color = "bg-purple-800/50";
    border_color = "border-purple-400";
  }
  if (star_rating > 7.99) {
    bg_color = "bg-gray-700/50";
    border_color = "border-gray-500";
  }

  return { bg_color, border_color };
}

export function DifficultyCircle(props: {
  version: BeatmapVersion;
  size: number;
}) {
  const star_rating =
    props.version.attributes.star_rating < 9
      ? props.version.attributes.star_rating.toFixed(1)
      : "9.0";

  let pixel_size = props.size;

  return (
    <div className="flex">
      <Image
        src={`https://raw.githubusercontent.com/hiderikzki/osu-difficulty-icons/main/rendered/std/stars_${star_rating}@2x.png`}
        alt=""
        width={pixel_size}
        height={pixel_size}
        onClick={() => window.open(props.version.url)}
        className="cursor-pointer"
      />
    </div>
  );
}
