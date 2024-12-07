import { BountyTier, BountyType } from "@/src/_models/bounty";
import { Mod } from "@/src/_models/score";
import ModIcon from "../mods/mod_icon";
import { RewardTierPill } from "./reward_tier_pill";
import BountyTypePill from "./type_pill";

export function BountySearchContainer({
  modsFilter,
  setModsFilter,
  typeFilter,
  setTypeFilter,
  displayStyle,
  setDisplayStyle,
  sortType,
  setSortType,
  bountyTierFilter,
  setBountyTierFilter,
  setSearchFilter,
}: {
  modsFilter: Mod[];
  setModsFilter: any;
  typeFilter: BountyType;
  setTypeFilter: any;
  displayStyle: "slim" | "card";
  setDisplayStyle: any;
  sortType: "recent" | "reward" | "popularity";
  setSortType: any;
  bountyTierFilter: BountyTier;
  setBountyTierFilter: any;
  setSearchFilter: any;
}) {
  const switchModFilter = (mod: Mod) => {
    setModsFilter(
      modsFilter.includes(mod)
        ? [...modsFilter].filter((v) => v != mod)
        : [...modsFilter, mod]
    );
  };

  const switchTypeFilter = (type: BountyType) => {
    setTypeFilter(
      typeFilter.includes(type)
        ? [...typeFilter].filter((v) => v != type)
        : [...typeFilter, type]
    );
  };

  return (
    <div className="flex flex-col bg-slate-700 w-full h-fit rounded-xl p-4 space-y-3 place-content-center select-none">
      <div className="flex w-full h-8">
        <input
          type="text"
          className="w-full rounded-xl text-center bg-slate-800"
          placeholder="Search bounties here..."
          onChange={(e) => setSearchFilter(e.currentTarget.value)}
        />
      </div>
      <div className="flex flex-col w-full h-fit text-sm">
        <div className="flex flex-row w-full h-full">
          <div className="flex flex-col w-2/3 h-full space-y-3">
            <div className="flex flex-row space-x-4 items-center">
              <p>Type</p>
              <div className="flex flex-row space-x-3">
                <BountyTypePill
                  type={"Clear"}
                  clickAction={() =>
                    typeFilter == "Clear"
                      ? setTypeFilter("Any")
                      : setTypeFilter("Clear")
                  }
                  grayed={typeFilter != "Clear"}
                />
                <BountyTypePill
                  type={"FC"}
                  clickAction={() =>
                    typeFilter == "FC"
                      ? setTypeFilter("Any")
                      : setTypeFilter("FC")
                  }
                  grayed={typeFilter != "FC"}
                />
              </div>
            </div>
            <div className="text-sm flex flex-row space-x-4">
              <p>Mods</p>
              <div className="flex flex-row space-x-2">
                <ModIcon
                  mod="hd"
                  width="w-7"
                  grayed={!modsFilter?.includes("hd")}
                  clickAction={() => switchModFilter("hd")}
                />
                <ModIcon
                  mod="hr"
                  width="w-7"
                  grayed={!modsFilter?.includes("hr")}
                  clickAction={() => switchModFilter("hr")}
                />
                <ModIcon
                  mod="dt"
                  width="w-7"
                  grayed={!modsFilter?.includes("dt")}
                  clickAction={() => switchModFilter("dt")}
                />
                <ModIcon
                  mod="ez"
                  width="w-7"
                  grayed={!modsFilter?.includes("ez")}
                  clickAction={() => switchModFilter("ez")}
                />
                <ModIcon
                  mod="fl"
                  width="w-7"
                  grayed={!modsFilter?.includes("fl")}
                  clickAction={() => switchModFilter("fl")}
                />
              </div>
            </div>
            <div className="text-sm flex flex-row place-content-start items-center space-x-2">
              <p>Tier</p>
              <div className="flex flex-row space-x-2 flex-wrap">
                <RewardTierPill
                  tier={"Common"}
                  clickAction={() =>
                    bountyTierFilter == "Common"
                      ? setBountyTierFilter("Any")
                      : setBountyTierFilter("Common")
                  }
                  grayed={bountyTierFilter != "Common"}
                />
                <RewardTierPill
                  tier={"Uncommon"}
                  clickAction={() =>
                    bountyTierFilter == "Uncommon"
                      ? setBountyTierFilter("Any")
                      : setBountyTierFilter("Uncommon")
                  }
                  grayed={bountyTierFilter != "Uncommon"}
                />
                <RewardTierPill
                  tier={"Rare"}
                  clickAction={() =>
                    bountyTierFilter == "Rare"
                      ? setBountyTierFilter("Any")
                      : setBountyTierFilter("Rare")
                  }
                  grayed={bountyTierFilter != "Rare"}
                />
                <RewardTierPill
                  tier={"Epic"}
                  clickAction={() =>
                    bountyTierFilter == "Epic"
                      ? setBountyTierFilter("Any")
                      : setBountyTierFilter("Epic")
                  }
                  grayed={bountyTierFilter != "Epic"}
                />
                <RewardTierPill
                  tier={"Legendary"}
                  clickAction={() =>
                    bountyTierFilter == "Legendary"
                      ? setBountyTierFilter("Any")
                      : setBountyTierFilter("Legendary")
                  }
                  grayed={bountyTierFilter != "Legendary"}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col w-1/3 h-full space-y-3">
            <div className="flex flex-row space-x-2">
              <p>Style</p>
              <button
                className={
                  displayStyle == "slim" ? "text-white" : "text-gray-600"
                }
                onClick={() => setDisplayStyle("slim")}
              >
                slim
              </button>
              <button
                className={
                  displayStyle == "card" ? "text-white" : "text-gray-600"
                }
                onClick={() => setDisplayStyle("card")}
              >
                card
              </button>
            </div>
            <div className="flex flex-row space-x-4 items-center">
              <p>Sort</p>
              <div className="flex flex-row space-x-3">
                <p
                  className={`  hover:text-white ${
                    sortType == "recent" ? "text-white" : "text-gray-600"
                  } cursor-pointer`}
                  onClick={() => setSortType("recent")}
                >
                  recent
                </p>
                <p
                  className={` hover:text-white ${
                    sortType == "reward" ? "text-white" : "text-gray-600"
                  } cursor-pointer`}
                  onClick={() => setSortType("reward")}
                >
                  reward
                </p>
                {/* <p
                  className={` hover:text-white ${
                    sortType == "popularity" ? "text-white" : "text-gray-600"
                  } cursor-pointer`}
                  onClick={() => setSortType("popularity")}
                >
                  popularity
                </p> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
