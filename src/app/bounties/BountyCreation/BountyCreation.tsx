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
    <div className="fixed w-[105vw] h-full z-50 bg-black/50 flex place-content-center items-start backdrop-blur-sm space-x-8">
      <div
        className="flex flex-col w-1/2 h-2/3 bg-slate-700 rounded-xl space-y-8 place-content-start items-center mt-24 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {renderStep()}
      </div>
      <div
        className="flex flex-col w-1/4 h-2/3 bg-slate-800/70 rounded-xl space-y-8 place-content-start items-center mt-24 p-8  overflow-y-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        {step == "intro" || bountyDraft.beatmapset.id == 0 ? (
          <p className="text-4xl text-gray-500 text-center h-full flex items-center">
            Bounty draft will be displayed here
          </p>
        ) : (
          <div className="flex flex-col w-full h-full space-y-6">
            <p className="text-2xl p-2 px-4 bg-slate-700/70 rounded-xl">
              Bounty draft
            </p>
            <BountyDescriptiveContainer bounty={bountyDraft} />
            {step != "final" ? (
              <div className="flex flex-row rounded-xl bg-slate-700/70 w-full h-fit items-center">
                <div className="flex flex-col space-y-1 p-2 px-4">
                  <p className="">Bounty cost</p>
                  <div className="flex flex-row space-x-2">
                    <p className="font-thin">Base</p>
                    <p>
                      🪙{bounty_base_cost(bountyDraft).toLocaleString("en-US")}
                    </p>
                  </div>
                  <div className="flex flex-row space-x-2">
                    <p className="font-thin">+ Reward</p>
                    <p>🪙{bountyDraft.reward.toLocaleString("en-US")}</p>
                  </div>
                  <div className="flex flex-row space-x-2">
                    <p className="font-thin">= Total</p>
                    <p>
                      🪙
                      {(
                        bounty_base_cost(bountyDraft) + bountyDraft.reward
                      ).toLocaleString("en-US")}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
