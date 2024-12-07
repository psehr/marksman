"use client";

import { BeatmapSlim } from "@/src/_components/beatmap/beatmap_slim";
import { VersionPill } from "@/src/_components/beatmap/version_pill";
import { BasicButton } from "@/src/_components/buttons";
import Loading from "@/src/_components/loading";
import { BeatmapSet, BeatmapVersion } from "@/src/_models/beatmap";
import { Bounty } from "@/src/_models/bounty";
import { fetchSearchBeatmapset } from "@/src/_services/osu_api/beatmap";
import { parseBeatmapsetsFromOsuApiSearch } from "@/src/_services/utils/parsers/beatmap";
import { SearchBeatmaps } from "osu-api-extended/dist/types/v2/search_all";
import { FormEvent, ReactNode, useState } from "react";

export function BeatmapSelection({
  setStep,
  setBountyCreationModalDisplay,
  bountyDraft,
  setBountyDraft,
}: {
  setStep: any;
  setBountyCreationModalDisplay: any;
  bountyDraft: Bounty;
  setBountyDraft: any;
}) {
  const draftSelectBeatmapset = (beatmapset: BeatmapSet) => {
    const draftCopy = { ...bountyDraft, beatmapset: beatmapset };
    setBountyDraft(draftCopy);
  };

  const draftSelectBeatmapVersion = (version: BeatmapVersion) => {
    const draftCopy = { ...bountyDraft, version: version };
    setBountyDraft(draftCopy);
  };

  const [searchResults, setSearchResults] = useState<BeatmapSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBeatmapset, setSelectedBeatmapset] = useState<BeatmapSet>();
  const [selectedVersion, setSelectedVersion] = useState<BeatmapVersion>();

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem(
      "search_input"
    )! as HTMLInputElement;

    setIsLoading(true);

    fetchSearchBeatmapset(input.value).then((data) => {
      setIsLoading(false);
      setSearchResults(
        parseBeatmapsetsFromOsuApiSearch(data as SearchBeatmaps)
      );
    });
  };

  const renderSearchResults = () => {
    let nodes: ReactNode[] = [];
    searchResults.forEach((result) => {
      const set = (
        <BeatmapSlim
          beatmapset={result}
          key={result.id}
          clickAction={() => {
            setSelectedBeatmapset(result);
            draftSelectBeatmapset(result);
          }}
          selected={selectedBeatmapset == result}
        />
      );

      nodes.push(set);
    });

    return nodes.slice(0, 10);
  };

  const renderSelectedBeatmapVersions = () => {
    let nodes: ReactNode[] = [];
    selectedBeatmapset?.versions.forEach((version) => {
      nodes.push(
        <div
          className="w-full text-nowrap cursor-pointer"
          onClick={() => {
            setSelectedVersion(version);
            draftSelectBeatmapVersion(version);
          }}
          key={version.id}
        >
          <VersionPill
            version={version}
            maxLength={12}
            selected={selectedVersion == version}
          />
        </div>
      );
    });
    return nodes;
  };

  return (
    <div className="flex flex-col w-full h-full space-y-2 place-content-between">
      <div className="flex flex-row rounded-xl bg-slate-800 w-fit h-fit items-center">
        <p className="text-2xl p-2 px-4">Step I.</p>
        <p className="text-xl font-thin p-2 px-4">Beatmap selection</p>
      </div>
      <div className="flex flex-row h-3/4 w-full place-content-evenly space-x-4">
        <div className="flex flex-col rounded-xl bg-slate-800 w-3/4 h-full p-4 space-y-4 overflow-y-scroll ">
          <form
            action=""
            onSubmit={(e) => {
              handleSearch(e);
            }}
            className="flex flex-row space-x-2"
          >
            <input
              type="text"
              id="search_input"
              placeholder="Search beatmap.."
            />
            <input
              type="submit"
              value="Search"
              className="w-fit px-4 p-1 cursor-pointer hover:bg-slate-600"
            />
          </form>
          <div className="w-full h-full space-y-1 flex flex-col place-content-start items-center">
            {isLoading ? (
              <div className="h-full flex items-center">
                <Loading />
              </div>
            ) : (
              renderSearchResults()
            )}
          </div>
        </div>
        <div className="flex flex-col rounded-xl bg-slate-800 w-1/4 h-full p-4 place-content-start items-center">
          {selectedBeatmapset ? (
            <div className="flex flex-col space-y-4 w-full h-full">
              <p className="text-center">
                Select the difficulty you want to use
              </p>
              <div className="flex flex-col space-y-2 overflow-y-scroll h-full w-full">
                {renderSelectedBeatmapVersions()}
              </div>
            </div>
          ) : (
            <p className="h-full flex text-4xl text-gray-600 text-center items-center">
              Select a beatmap
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-row rounded-xl bg-slate-800 w-full h-16 p-4 px-4 items-center place-content-between">
        <div className="flex flex-row space-x-2">
          <BasicButton
            onClick={() => {
              setBountyCreationModalDisplay(false);
            }}
            color="red"
          >
            Cancel
          </BasicButton>
          <BasicButton
            onClick={() => {
              setStep("intro");
            }}
            color="blue"
          >
            Manual beatmap selection
          </BasicButton>
        </div>
        <div className="flex flex-row space-x-2">
          <BasicButton
            onClick={() => {
              setStep("intro");
            }}
            color="green"
          >
            Previous step
          </BasicButton>
          {bountyDraft.version.id != 0 ? (
            <BasicButton
              onClick={() => {
                setStep("base_requirements");
              }}
              color="green"
            >
              Next step
            </BasicButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
