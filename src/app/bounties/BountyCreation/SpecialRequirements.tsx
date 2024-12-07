import { BasicButton } from "@/src/_components/buttons";
import { Bounty } from "@/src/_models/bounty";
import { useState } from "react";

export function AdditionalRequirements({
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
  const draftSelectLeniency = (leniency: number) => {
    const draftCopy = { ...bountyDraft, sliderend_leniency: leniency };
    setBountyDraft(draftCopy);
  };

  const [selectedLeniency, setSelectedLeniency] = useState(
    bountyDraft.sliderend_leniency
  );

  return (
    <div className="flex flex-col w-full h-full space-y-2 place-content-between">
      <div className="flex flex-row rounded-xl bg-slate-800 w-fit h-fit items-center">
        <p className="text-2xl p-2 px-4">Step III.</p>
        <p className="text-xl font-thin p-2 px-4">
          Additional bounty requirements
        </p>
      </div>
      <div className="flex flex-col h-3/4 w-full space-y-4">
        {bountyDraft.type == "FC" ? (
          <div className="flex flex-col rounded-xl bg-slate-800 w-full h-fit p-4 items-start space-y-4">
            <p>Select slider-end leniency</p>
            <div className="space-y-1">
              <p className="text-sm">
                The slider-end leniency is the amount of combo leniency allowed
                for a score to be considered an FC, the default value is 5 but
                you can use this slider to increase it further.
              </p>
              <p className="text-xs italic">
                i.e: For a max combo of 1334, if the slider-end leniency is set
                to 5, the achieved combo must be at least 1329 for it to be
                considered an FC.
              </p>
            </div>
            <div className="flex flex-col w-full h-fit place-content-center items-center p-2 space-y-4">
              <datalist id="markers">
                <option value="5"></option>
                <option value="6"></option>
                <option value="7"></option>
                <option value="8"></option>
                <option value="9"></option>
                <option value="10"></option>
                <option value="11"></option>
                <option value="12"></option>
                <option value="13"></option>
                <option value="14"></option>
                <option value="15"></option>
              </datalist>
              <input
                type="range"
                min={5}
                max={15}
                defaultValue={selectedLeniency}
                className="w-1/2"
                list="markers"
                onChange={(e) => {
                  setSelectedLeniency(parseInt(e.currentTarget.value));
                  draftSelectLeniency(parseInt(e.currentTarget.value));
                }}
              />
            </div>
            <div className="w-full text-center">
              <p>Selected leniency: {selectedLeniency}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col rounded-xl bg-slate-800 w-full h-1/3 p-4 items-center place-content-center space-y-4">
            <p className="text-3xl text-gray-600">
              Additional requirements are not available yet.
            </p>
          </div>
        )}
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
              setStep("base_requirements");
            }}
            color="green"
          >
            Previous step
          </BasicButton>

          {
            <BasicButton
              onClick={() => {
                setStep("reward");
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
