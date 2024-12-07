"use client";

import Loading from "@components/loading";
import ModIcon from "@components/mods/mod_icon";
import ModList from "@components/mods/mod_list";
import { fetchBeatmapsetDetails } from "@services/osu_api/beatmap";
import { parseBeatmapsetFromOsuApiBeatmap } from "@services/utils/parsers/beatmap";
import { BeatmapSet } from "@models/beatmap";
import { beatmaps_details_set_response } from "osu-api-extended/dist/types/v2/beatmaps_details_set";
import { ReactNode, useEffect, useState } from "react";
import { Bounty, BountyTier, BountyType } from "@models/bounty";
import { BeatmapCard } from "@/src/_components/beatmap/beatmap_card";
import { Mod } from "@/src/_models/score";
import { BeatmapSlim } from "@/src/_components/beatmap/beatmap_slim";
import { BountySearchContainer } from "@/src/_components/bounty/search_and_filters";
import { VersionPill } from "@/src/_components/beatmap/version_pill";
import {
  TbStarFilled,
  TbArrowBigUpFilled,
  TbArrowBigDownFilled,
} from "react-icons/tb";
import { BountyRewardPill } from "@/src/_components/bounty/reward_pill";
import InlineUser from "@/src/_components/user/inline";
import { formatDistanceStrict } from "date-fns";
import { BasicButton } from "@/src/_components/buttons";
import { CreateBountyModal } from "./BountyCreation/BountyCreation";
import { BountyDescriptiveContainer } from "@/src/_components/bounty/descriptive_container";
import { fetchAllBounties } from "@/src/_services/database/bounties";
import BountyClaim from "./BountyClaim/BountyClaim";
// @ts-ignore
import FuzzySearch from "fuzzy-search";
import { search } from "osu-api-extended/dist/routes/v2";

export default function Bounties() {
  const [bounties, setBounties] = useState<Bounty[]>();
  const [selectedBounty, setSelectedBounty] = useState<Bounty>();
  const [isLoading, setIsLoading] = useState(true);
  const [bountyCreationModalDisplay, setBountyCreationModalDisplay] =
    useState(false);

  const [bountyClaimModal, setBountyClaimModal] = useState<{
    display: boolean;
    type: "manual" | "auto";
  }>({ display: false, type: "manual" });

  const [sortType, setSortType] = useState<"recent" | "reward" | "popularity">(
    "recent"
  );

  const [typeFilter, setTypeFilter] = useState<BountyType>("Any");
  const [modsFilter, setModsFilter] = useState<Mod[]>([
    "ez",
    "dt",
    "fl",
    "hd",
    "hr",
  ]);
  const [bountyTierFilter, setBountyTierFilter] = useState<BountyTier>("Any");
  const [searchFilter, setSearchFilter] = useState("");

  const [displayStyle, setDisplayStyle] = useState<"card" | "slim">("slim");

  const [refreshBounties, setRefreshBounties] = useState(false);

  // useEffect(() => {
  //   fetchBeatmapsetDetails(1781688).then((result) => {
  //     const bset = parseBeatmapsetFromOsuApiBeatmap(
  //       result as beatmaps_details_set_response
  //     );
  //     setTestMap(bset);
  //     setTestBounty({
  //       id: (Date.now() + (Math.random() * 1000).toFixed()).toString(),
  //       timestamp: Date.now(),
  //       title: "Bounty title",
  //       creator: {
  //         id: 9239673,
  //         name: "pseh",
  //         image: "https://a.ppy.sh/9239673?1729549056.jpeg",
  //       },
  //       beatmapset: bset!,
  //       version: bset!.versions[0],
  //       required_mods: [],
  //       disallowed_mods: ["ez"],
  //       type: "Clear",
  //       minimum_accuracy: 0,
  //       minimum_grade: "D",
  //       sliderend_leniency: 0,
  //       reward: 10000,
  //       estimated_difficulty: 3,
  //       comments: [],
  //       stats: {
  //         upvotes: 0,
  //         downvotes: 0,
  //         reports: 0,
  //       },
  //       claimed: false,
  //     });
  //   });
  // }, []);

  // useEffect(() => {
  //   fetchBeatmapsetDetails(1765605).then((result) => {
  //     const bset = parseBeatmapsetFromOsuApiBeatmap(
  //       result as beatmaps_details_set_response
  //     );
  //     setTestMap2(bset);
  //     setTestBounty2({
  //       id: Date.now().toString(),
  //       timestamp: Date.now(),
  //       title: "Bounty title",
  //       creator: {
  //         id: 9239673,
  //         name: "pseh",
  //         image: "https://a.ppy.sh/9239673?1729549056.jpeg",
  //       },
  //       beatmapset: bset!,
  //       version: bset!.versions[0],
  //       required_mods: ["hd", "hr"],
  //       disallowed_mods: ["ez"],
  //       type: "FC",
  //       minimum_accuracy: 0,
  //       minimum_grade: "D",
  //       sliderend_leniency: 0,
  //       reward: 50000,
  //       estimated_difficulty: 8,
  //       comments: [],
  //       stats: {
  //         upvotes: 0,
  //         downvotes: 0,
  //         reports: 0,
  //       },
  //       claimed: false,
  //     });
  //   });
  // }, []);

  // useEffect(() => {
  //   fetchBeatmapsetDetails(107565).then((result) => {
  //     const bset = parseBeatmapsetFromOsuApiBeatmap(
  //       result as beatmaps_details_set_response
  //     );
  //     setTestMap3(bset);
  //     setTestBounty3({
  //       id: Date.now().toString(),
  //       timestamp: Date.now(),
  //       title: "Bounty title",
  //       creator: {
  //         id: 9239673,
  //         name: "pseh",
  //         image: "https://a.ppy.sh/9239673?1729549056.jpeg",
  //       },
  //       beatmapset: bset!,
  //       version: bset!.versions[0],
  //       required_mods: ["dt", "hd", "hr"],
  //       disallowed_mods: ["ez"],
  //       type: "FC",
  //       minimum_accuracy: 0,
  //       minimum_grade: "D",
  //       sliderend_leniency: 0,
  //       reward: 100000,
  //       estimated_difficulty: 10,
  //       comments: [],
  //       stats: {
  //         upvotes: 0,
  //         downvotes: 0,
  //         reports: 0,
  //       },
  //       claimed: false,
  //     });
  //   });
  // }, []);

  useEffect(() => {
    setRefreshBounties(!refreshBounties);
  }, [sortType, typeFilter, modsFilter, bountyTierFilter]);

  useEffect(() => {
    setIsLoading(true);
    setBounties([]);
    fetchAllBounties({
      sortMethod: sortType,
      typeFilter: typeFilter,
      modsFilter: modsFilter.length ? modsFilter.sort() : undefined,
      bountyTierFilter: bountyTierFilter,
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

  const renderBounties = () => {
    let nodes: ReactNode[] = [];
    if (!bounties?.length) {
      return (
        <p className="text-3xl text-gray-500">No bounties available ; ;</p>
      );
    }
    // let displayed_bounties = [...bounties];
    // if (searchFilter.length) {
    //   const searcher = new FuzzySearch(
    //     displayed_bounties,
    //     [
    //       "creator.name",
    //       "version.metadata.title",
    //       "version.metadata.artist",
    //       "beatmapset.creator.name",
    //     ],
    //     {
    //       caseSensitive: false,
    //     }
    //   );
    //   displayed_bounties = searcher.search(searchFilter);
    // }
    bounties?.forEach((bounty) => {
      nodes.push(
        <div
          className="flex w-full h-fit"
          onClick={() => {
            setSelectedBounty(bounty);
          }}
          key={bounty.id}
        >
          {displayStyle == "slim" ? (
            <BeatmapSlim
              beatmapset={bounty.beatmapset}
              bounty={bounty}
              maxLength={30}
            />
          ) : (
            <BeatmapCard
              beatmapset={bounty.beatmapset}
              bounty={bounty}
              simplified
            />
          )}
        </div>
      );
    });

    return nodes;
  };

  const renderSelectedBounty = () => {
    if (selectedBounty) {
      return (
        <div className="w-full h-full space-y-4">
          <BountyDescriptiveContainer bounty={selectedBounty}>
            <BasicButton
              color="green"
              onClick={() =>
                setBountyClaimModal({ display: true, type: "auto" })
              }
              large
            >
              Claim bounty
            </BasicButton>
            <BasicButton
              color="green"
              onClick={() =>
                setBountyClaimModal({ display: true, type: "manual" })
              }
              large
            >
              Claim bounty (manual)
            </BasicButton>

            <BasicButton
              color="blue"
              onClick={() =>
                setBountyClaimModal({ display: true, type: "auto" })
              }
              large
            >
              Community section
            </BasicButton>
          </BountyDescriptiveContainer>

          {/* 
        
          <div>
            <div className="w-full h-fit bg-black/20 p-4 rounded-xl space-y-4">
              <p>Comments (2)</p>
              <div className="flex flex-col">
                <InlineUser
                  user={{
                    id: 9239673,
                    name: "pseh",
                    image: "https://a.ppy.sh/9239673?1729549056.jpeg",
                  }}
                />
                <p className="text-sm font-normal">
                  This is an example comment.
                </p>
              </div>
              <div className="flex flex-col">
                <InlineUser
                  user={{
                    id: 9239673,
                    name: "pseh",
                    image: "https://a.ppy.sh/9239673?1729549056.jpeg",
                  }}
                />
                <p className="text-sm font-normal">
                  This is an example comment x2.
                </p>
              </div>
              <div className="flex w-full h-8 text-sm font-light items-center space-x-2 place-content-center">
                <input
                  type="text"
                  className="w-2/3 h-full bg-slate-700 rounded-xl px-2"
                  placeholder="Type your comment here.."
                />
                <BasicButton onClick={() => {}}>Send</BasicButton>
              </div>
            </div>
          </div> */}
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col sm:flex-row w-full h-full place-content-center items-start space-x-4 font-extrabold overflow-y-auto">
      <div className="flex flex-col w-fit sm:w-[45%] min-h-full h-fit bg-slate-800/70 place-content-start items-center p-8 mt-8 rounded-xl space-y-4 shadow-lg">
        <div className="flex flex-row w-full h-fit bg-slate-700 p-4 rounded-xl space-x-2 place-content-center shadow-lg">
          <BasicButton
            onClick={() => {
              setBountyCreationModalDisplay(true);
            }}
            color="green"
          >
            Create a new bounty
          </BasicButton>
          <BasicButton
            onClick={() => setRefreshBounties(!refreshBounties)}
            color="blue"
          >
            Refresh bounties
          </BasicButton>
        </div>
        <BountySearchContainer
          displayStyle={displayStyle}
          setDisplayStyle={setDisplayStyle}
          modsFilter={modsFilter}
          setModsFilter={setModsFilter}
          sortType={sortType}
          setSortType={setSortType}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          bountyTierFilter={bountyTierFilter}
          setBountyTierFilter={setBountyTierFilter}
          setSearchFilter={setSearchFilter}
        />
        {/* Render bounties in the following div */}
        <div className="p-8 flex flex-col w-full min-h-full h-fit bg-slate-700 rounded-xl space-y-2 place-content-center items-center">
          {!isLoading ? (
            renderBounties()
          ) : (
            <div className="flex w-fit h-fit place-content-center items-center">
              <Loading />
            </div>
          )}
        </div>
      </div>
      <div className={`sticky top-0 sm:w-[25%] h-full`}>
        <div
          className={`my-8 flex flex-col w-full h-full space-y-2 place-content-center items-center rounded-xl`}
        >
          {selectedBounty ? (
            renderSelectedBounty()
          ) : (
            <p className="text-3xl text-center text-gray-400 w-2/3">
              Select a bounty to start hunting
            </p>
          )}
        </div>
      </div>

      {bountyCreationModalDisplay ? (
        <CreateBountyModal
          setBountyCreationModalDisplay={setBountyCreationModalDisplay}
          refreshBounties={refreshBounties}
          setRefreshBounties={setRefreshBounties}
        />
      ) : null}

      {bountyClaimModal.display ? (
        <BountyClaim
          bountyClaimModal={bountyClaimModal}
          setBountyClaimModal={setBountyClaimModal}
          bounty_id={selectedBounty?.id!}
        />
      ) : null}
    </div>
  );
}
