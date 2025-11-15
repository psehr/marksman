import { BasicButton } from "@/src/_components/buttons";
import { useState } from "react";
import { Introduction } from "./Introduction";
import { BeatmapSelection } from "./BeatmapSelection";
import { BaseRequirements } from "./BaseRequirements";
import { Bounty, initBounty } from "@/src/_models/bounty";
import { BountyDescriptiveContainer } from "@/src/_components/bounty/descriptive_container";
import { AdditionalRequirements } from "./SpecialRequirements";
import { Reward } from "./Reward";
import { bounty_base_cost } from "@/src/_utils/maths";
import { Final } from "./Final";
// @ts-ignore
import hash from "hash-sum";
import BountyCostContainer from "./BountyCostContainer";

const API_URL = "http://localhost:3000/api";

const populateMissingBountyAttributes = (bountyDraft: Bounty) => {
  const addedCreator = {
    ...bountyDraft,
    creator: {
      id: 9239673,
      name: "pseh",
      image: "https://a.ppy.sh/9239673?1729549056.jpeg",
    },
  };

  const addedTimestamp = {
    ...addedCreator,
    timestamp: Date.now(),
  };

  const addedId = {
    ...addedTimestamp,
    id: addedTimestamp.creator.id + "_" + hash(addedTimestamp.timestamp),
  };

  return addedId;
};

export function CreateBountyModal({
  setBountyCreationModalDisplay,
  refreshBounties,
  setRefreshBounties,
}: {
  setBountyCreationModalDisplay: any;
  refreshBounties: boolean;
  setRefreshBounties: any;
}) {
  const [bountyDraft, setBountyDraft] = useState<Bounty>(
    initBounty() as Bounty
  );

  const submitBounty = async () => {
    const finalizedBounty = populateMissingBountyAttributes(bountyDraft);
    fetch(API_URL + "/bounties", {
      method: "POST",
      body: JSON.stringify(finalizedBounty),
    }).then((response) => {
      if (response.status == 200) {
        setBountyDraft(initBounty() as Bounty);
        setRefreshBounties(!refreshBounties);
        setBountyCreationModalDisplay(false);
      } else {
        alert("unknown error");
      }
    });
  };

  type step =
    | "intro"
    | "beatmap"
    | "base_requirements"
    | "additional_requirements"
    | "reward"
    | "final";
  const [step, setStep] = useState<step>("intro");

  const renderStep = () => {
    switch (step) {
      case "intro":
        return (
          <Introduction
            setStep={setStep}
            setBountyCreationModalDisplay={setBountyCreationModalDisplay}
          />
        );
      case "beatmap":
        return (
          <BeatmapSelection
            setStep={setStep}
            setBountyCreationModalDisplay={setBountyCreationModalDisplay}
            bountyDraft={bountyDraft}
            setBountyDraft={setBountyDraft}
          />
        );
      case "base_requirements":
        return (
          <BaseRequirements
            setStep={setStep}
            setBountyCreationModalDisplay={setBountyCreationModalDisplay}
            bountyDraft={bountyDraft}
            setBountyDraft={setBountyDraft}
          />
        );

      case "additional_requirements":
        return (
          <AdditionalRequirements
            setStep={setStep}
            setBountyCreationModalDisplay={setBountyCreationModalDisplay}
            bountyDraft={bountyDraft}
            setBountyDraft={setBountyDraft}
          />
        );
      case "reward":
        return (
          <Reward
            setStep={setStep}
            setBountyCreationModalDisplay={setBountyCreationModalDisplay}
            bountyDraft={bountyDraft}
            setBountyDraft={setBountyDraft}
          />
        );
      case "final":
        return (
          <Final
            setStep={setStep}
            setBountyCreationModalDisplay={setBountyCreationModalDisplay}
            bountyDraft={bountyDraft}
            setBountyDraft={setBountyDraft}
            submitBounty={submitBounty}
          />
        );

      default:
        break;
    }
  };

  return (
    <div className="fixed top-0 w-full h-full z-50 bg-black/50 backdrop-blur-sm">
      <div
        className="fixed -top-12 w-full h-full flex place-content-center items-center  md:space-x-8"
        style={{ marginLeft: "0px" }}
      >
        <div
          className="flex flex-col w-full md:w-1/2 h-full md:h-2/3 bg-slate-700 md:rounded-lg space-y-8 place-content-around items-center md:mt-24 md:p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {renderStep()}
        </div>
        <div
          className="hidden md:flex flex-col w-1/4 h-2/3 bg-slate-800/70 rounded-lg place-content-start items-center mt-24 p-4  overflow-y-scroll"
          onClick={(e) => e.stopPropagation()}
        >
          {step == "intro" || bountyDraft.beatmapset.id == 0 ? (
            <p className="text-4xl text-gray-500 text-center h-full flex items-center">
              Bounty draft will be displayed here
            </p>
          ) : (
            <div className="flex flex-col w-full h-fit space-y-4">
              <p className="text-2xl p-2 px-4 bg-slate-700/70 rounded-lg">
                Bounty draft
              </p>
              <BountyDescriptiveContainer bounty={bountyDraft} />
              {step != "final" ? (
                <BountyCostContainer bountyDraft={bountyDraft} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
