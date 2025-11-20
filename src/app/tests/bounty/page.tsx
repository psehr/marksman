"use client";

import BeatmapCardNew from "@/src/_components/beatmap/card_new";
import Loading from "@/src/_components/loading";
import { Bounty } from "@/src/_models/bounty";
import { fetchAllBounties } from "@/src/_services/database/bounties";
import { ReactNode, useEffect, useState } from "react";
import BountyCardNew from "./BountyCard";
import { Lexend_Deca } from "next/font/google";
// @ts-ignore
import FuzzySearch from "fuzzy-search";

const lexend = Lexend_Deca({ subsets: ["latin"] });

export default function BountyCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [refreshBounties, setRefreshBounties] = useState(false);

  const [searchFilter, setSearchFilter] = useState("");

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
  }, [refreshBounties]);

  useEffect(() => {
    setIsLoading(true);
    if (searchFilter.length && bounties) {
      const searcher = new FuzzySearch(
        bounties,
        [
          "creator.name",
          "version.metadata.title",
          "version.metadata.artist",
          "version.difficulty_name",
          "beatmapset.creator.name",
        ],
        {
          caseSensitive: false,
        }
      );
      setBounties(searcher.search(searchFilter));
    } else {
      setRefreshBounties(!refreshBounties);
    }
    setIsLoading(false);
  }, [searchFilter]);

  const renderCards = () => {
    let cards: ReactNode[] = [];

    bounties.forEach((bounty) => {
      if (bounty) {
        cards.push(
          <BountyCardNew
            bounty={bounty}
            shareAction={() => {}}
            claimAction={() => {}}
            pinAction={() => {}}
            heartAction={() => {}}
            pinned={false}
            claiming={false}
            hearted={false}
            key={bounty.id}
          />
        );
      }
    });

    return cards;
  };

  return (
    <div
      className={
        "relative w-full h-fit flex flex-col gap-4 mt-8 " + lexend.className
      }
    >
      <div className="min-h-screen flex place-content-center gap-4 px-4 lg:px-0">
        <div className="sticky top-32 w-48 h-96 hidden flex-col bg-slate-800 place-content-center items-center text-4xl text-white/30 lg:flex">
          <p>Filters ici</p>
        </div>
        <div className="flex flex-col w-full lg:w-1/2 h-fit place-content-start items-center gap-8">
          <div className="flex flex-col w-full h-fit items-center place-content-center gap-2">
            <div className="w-full flex h-12 place-content-center items-center rounded-lg">
              <input
                className="flex size-full text-xl"
                placeholder="Search bounties here..."
                onChange={(e) => setSearchFilter(e.currentTarget.value)}
              ></input>
            </div>
            <p className="text-sm text-white/30">
              {bounties.length} results found
            </p>
          </div>
          <div className="flex flex-col w-full gap-2 items-center">
            {isLoading ? <Loading /> : renderCards()}
          </div>
        </div>
        <div className="sticky top-32 w-48 h-96 hidden flex-col bg-slate-800 place-content-center items-center text-4xl text-white/30 lg:flex">
          <p>Help</p>
          <p>Creation</p>
          <p>Refresh</p>
          <p>...</p>
        </div>
      </div>
      <div className="w-full h-8 bg-slate-800"></div>
    </div>
  );
}
