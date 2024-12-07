import { BasicButton } from "@/src/_components/buttons";
import { Bounty } from "@/src/_models/bounty";
import { bounty_base_cost } from "@/src/_utils/maths";
import { useEffect, useState } from "react";
import { TbAlertTriangleFilled } from "react-icons/tb";
import { FaCheckSquare } from "react-icons/fa";
import Loading from "@/src/_components/loading";

export function Final({
  setStep,
  setBountyCreationModalDisplay,
  bountyDraft,
  setBountyDraft,
  submitBounty,
}: {
  setStep: any;
  setBountyCreationModalDisplay: any;
  bountyDraft: Bounty;
  setBountyDraft: any;
  submitBounty: any;
}) {
  const TEMP_BALANCE = 1000000;
  const BASE_COST = bounty_base_cost(bountyDraft);
  const REWARD_COST = bountyDraft.reward;
  const FUTURE_BALANCE = TEMP_BALANCE - BASE_COST - REWARD_COST;

  const [isLoading, setIsLoading] = useState(false);

  const submitAction = () => {
    setIsLoading(true);
    submitBounty();
  };

  const [bountyDesc, setBountyDesc] = useState(bountyDraft.title);
  const draftEditBountyDesc = (desc: string) => {
    const draftCopy = { ...bountyDraft, title: desc };
    setBountyDraft(draftCopy);
  };

  useEffect(() => {
    draftEditBountyDesc(bountyDesc);
  }, [bountyDesc]);

  if (isLoading) {
    return (
      <div className="flex w-full h-full place-content-center items-center">
        <Loading />
      </div>
    );
  } else
    return (
      <div className="flex flex-col w-full h-full space-y-2 place-content-between">
        <div className="flex flex-row rounded-xl bg-slate-800 w-fit h-fit items-center">
          <p className="text-2xl p-2 px-4">Step V.</p>
          <p className="text-xl font-thin p-2 px-4">Recap</p>
        </div>
        <div className="flex flex-col h-fit w-full space-y-4">
          <div className="flex flex-col rounded-xl bg-slate-800 w-full h-fit p-4 items-start">
            <p>
              Before submitting your creation, be sure to check the following:
            </p>
            <p className="ml-4">- You have verified the draft's content.</p>
            <p className="ml-4">
              - The reward is sufficiently high compared to the bounty's
              completion difficulty.
            </p>
            <p className="ml-4">
              - The bounty is at least remotely doable for someone as of some
              day (i.e don't be stupid).
            </p>
          </div>
          <div className="flex flex-col rounded-xl bg-slate-800 w-full h-fit p-4 items-start space-y-4">
            <p>If you wish so, you can add a visible comment on the bounty.</p>
            <textarea
              className="h-24 text-start place-content-start items-start p-2"
              placeholder="(Optional) Describe your bounty here.."
              maxLength={100}
              onChange={(e) => setBountyDesc(e.currentTarget.value)}
              defaultValue={bountyDesc}
            />
          </div>
          <div className="flex flex-col rounded-xl bg-slate-800 w-full h-fit p-4 items-start space-y-8">
            <div className="flex flex-row space-x-8 text-2xl font-thin place-content-center w-full items-center">
              <div className="text-center text-green-400 ">
                <p className="">Your balance</p>
                <p>🪙{TEMP_BALANCE.toLocaleString("en-US")}</p>
              </div>
              <p className="font-extrabold text-4xl">-</p>
              <div className="text-center text-red-400">
                <p className="">Base cost</p>
                <p>
                  🪙
                  {BASE_COST.toLocaleString("en-US")}
                </p>
              </div>
              <p className="font-extrabold text-4xl">-</p>
              <div className="text-center text-red-400">
                <p>Reward cost</p>
                <p>
                  🪙
                  {REWARD_COST.toLocaleString("en-US")}
                </p>
              </div>
              <p className="font-extrabold text-4xl">=</p>
              <div
                className={`text-center ${
                  FUTURE_BALANCE > 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                <p>Future balance</p>
                <p>
                  🪙
                  {FUTURE_BALANCE.toLocaleString("en-US")}
                </p>
              </div>
            </div>

            {FUTURE_BALANCE < 0 ? (
              <div className="flex flex-row space-x-2 items-center place-content-center w-full">
                <p className="">Insufficient balance</p>
                <TbAlertTriangleFilled />
              </div>
            ) : (
              <div className="flex flex-row space-x-2 items-center place-content-center w-full">
                <p>Sufficient balance</p>
                <FaCheckSquare />
              </div>
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
          </div>
          <div className="flex flex-row space-x-2">
            <BasicButton
              onClick={() => {
                setStep("reward");
              }}
              color="green"
            >
              Previous step
            </BasicButton>
            {FUTURE_BALANCE < 0 ? null : (
              <BasicButton onClick={submitAction} color="green">
                Validate draft and submit bounty 🥳
              </BasicButton>
            )}
          </div>
        </div>
      </div>
    );
}
