"use client";

import Loading from "@/src/_components/loading";
import { Bounty } from "@/src/_models/bounty";
import { fetchAllBounties } from "@/src/_services/database/bounties";
import { Lexend_Deca, Anonymous_Pro } from "next/font/google";
import React, { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { DifficultyCircle } from "@/src/_components/beatmap/difficulty_circle";
import { shortener } from "@/src/_utils/strings";
import BeatmapCardNew from "@/src/_components/beatmap/card_new";

const lexend = Lexend_Deca({ subsets: ["latin"] });
const anonymous = Anonymous_Pro({ weight: "700", subsets: ["latin"] });

export default function beatmapcard() {
  const [isLoading, setIsLoading] = useState(false);
  const [bounties, setBounties] = useState<Bounty[]>([]);

  useEffect(() => {
    setIsLoading(true);
    setBounties([]);
    fetchAllBounties({
      sortMethod: "recent",
      modsFilter: ["ez", "dt", "fl", "hd", "hr"],
    }).then((r) => {
      setIsLoading(false);
      setBounties(r);
    });
  }, []);

  const renderCards = () => {
    let cards: ReactNode[] = [];

    bounties.forEach((bounty) => {
      if (bounty) {
        cards.push(
          <BeatmapCardNew
            beatmapset={bounty.beatmapset}
            version={bounty.version}
            size="xl"
            key={bounty.id}
          />
        );
      }
    });

    return cards;
  };

  return (
    <div className="flex flex-col size-full place-content-start items-center space-y-2 mt-12">
      {isLoading ? <Loading /> : renderCards()}
    </div>
  );
}
