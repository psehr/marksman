import { RewardTierFromRewardGold } from "@/src/_components/bounty/reward_tier_pill";
import { BasicButton } from "@/src/_components/buttons";
import { Bounty } from "@/src/_models/bounty";
import { useEffect, useState } from "react";

export function Reward({
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
  const [selectedReward, setSelectedReward] = useState(bountyDraft.reward);
  const formatSelectedReward = () => {
    return selectedReward.toLocaleString("en-US");
  };

  const draftSelectReward = (reward: number) => {
    const draftCopy = {
      ...bountyDraft,
      reward: reward,
      estimated_difficulty: 0,
      tier: RewardTierFromRewardGold(reward),
    };
    setBountyDraft(draftCopy);
  };

  const MIN_REWARD = 1000;
  const MAX_REWARD = 1000000000;

  useEffect(() => {
    draftSelectReward(selectedReward);
  }, [selectedReward]);

  return (
    <div className="flex flex-col w-full h-full space-y-2 place-content-between">
      <div className="flex flex-row rounded-xl bg-slate-800 w-fit h-fit items-center">
        <p className="text-2xl p-2 px-4">Step IV.</p>
        <p className="text-xl font-thin p-2 px-4">Bounty reward</p>
      </div>
      <div className="flex flex-col h-3/4 w-full space-y-4">
        <div className="flex flex-col rounded-xl bg-slate-800 w-full h-fit p-4 items-start space-y-4">
          <p>Select bounty reward</p>
          <div className="space-y-2">
            <p className="text-sm">
              The bounty reward is what the player will receive on bounty
              completion.
            </p>
            <p className="text-sm">
              It will be added to the base creation cost of your bounty.
            </p>
            <p className="text-xs">
              The minimum reward is 🪙1,000 and the default is 🪙5,000.
            </p>
            <p className="text-xs">
              We suggest setting the reward as realistically as possible if you
              want it to be completed.
            </p>
            <p className="text-xs">
              Higher rewards will increase attractivity and engagement for
              players.
            </p>
          </div>
          <div className="flex flex-col w-full h-fit place-content-center items-center p-1 space-y-4">
            <input
              type="range"
              min={MIN_REWARD}
              max={100000}
              step={1000}
              className="w-1/2"
              value={selectedReward}
              onChange={(e) => {
                setSelectedReward(parseInt(e.currentTarget.value));
              }}
            />
            <input
              type="text"
              placeholder="or type the amount here.."
              className="w-1/2"
              onChange={(e) => {
                const v = parseInt(e.currentTarget.value);
                if (v && v >= MIN_REWARD && v <= MAX_REWARD) {
                  setSelectedReward(v);
                }
              }}
            />
          </div>
          <div className="flex flex-col w-full place-content-center items-center space-y-4 text-center">
            <p>Selected reward: 🪙{formatSelectedReward()}</p>
            <div className="flex flex-row space-x-4">
              <BasicButton
                onClick={() => {
                  setSelectedReward(
                    parseInt((selectedReward / 5000).toFixed(0)) * 5000
                  );
                }}
              >
                Round
              </BasicButton>
              <BasicButton
                onClick={() => setSelectedReward(selectedReward - 1000)}
              >
                - 🪙1,000
              </BasicButton>
              <BasicButton
                onClick={() => setSelectedReward(selectedReward + 1000)}
              >
                + 🪙1,000
              </BasicButton>
            </div>
          </div>
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
        </div>
        <div className="flex flex-row space-x-2">
          <BasicButton
            onClick={() => {
              setStep("additional_requirements");
            }}
            color="green"
          >
            Previous step
          </BasicButton>

          {
            <BasicButton
              onClick={() => {
                setStep("final");
              }}
              color="green"
            >
              Next step
            </BasicButton>
          }
        </div>
      </div>
    </div>
  );
}
