import BountyTypePill from "@/src/_components/bounty/type_pill";
import { BasicButton } from "@/src/_components/buttons";
import ModIcon from "@/src/_components/mods/mod_icon";
import { Bounty, BountyType } from "@/src/_models/bounty";
import { Mod } from "@/src/_models/score";
import { useEffect, useState } from "react";

export function BaseRequirements({
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
  const draftSelectBountyType = (type: BountyType) => {
    const draftCopy = { ...bountyDraft, type: type };
    setBountyDraft(draftCopy);
  };

  const draftSelectRequiredMods = (mods: Mod[]) => {
    const draftCopy = { ...bountyDraft, required_mods: mods.sort() };
    setBountyDraft(draftCopy);
  };

  const draftSelectDisallowedMods = (mods: Mod[]) => {
    const draftCopy = { ...bountyDraft, disallowed_mods: mods };
    setBountyDraft(draftCopy);
  };

  const switchRequiredModFilter = (mod: Mod) => {
    if (selectedDisallowedMods.includes(mod)) return;
    if (mod == "dt" && selectedRequiredMods.includes("ht")) return;
    if (mod == "ht" && selectedRequiredMods.includes("dt")) return;

    if (mod == "hr" && selectedRequiredMods.includes("ez")) return;
    if (mod == "ez" && selectedRequiredMods.includes("hr")) return;

    if (mod == "pf" && selectedRequiredMods.includes("sd")) return;
    if (mod == "sd" && selectedRequiredMods.includes("pf")) return;

    if (selectedRequiredMods.includes(mod))
      setSelectedRequiredMods(
        [...selectedRequiredMods].filter((v) => v != mod)
      );
    else {
      if (selectedRequiredMods.length == 3) return;
      setSelectedRequiredMods([...selectedRequiredMods, mod]);
    }
  };

  const switchDisallowedModFilter = (mod: Mod) => {
    if (selectedRequiredMods.includes(mod)) return;
    if (selectedType == "Clear" && mod == "nf") return;

    if (selectedDisallowedMods.includes(mod))
      setSelectedDisallowedMods(
        [...selectedDisallowedMods].filter((v) => v != mod)
      );
    else setSelectedDisallowedMods([...selectedDisallowedMods, mod]);
  };

  const [selectedType, setSelectedType] = useState<BountyType>(
    bountyDraft.type
  );
  const [selectedRequiredMods, setSelectedRequiredMods] = useState<Mod[]>(
    bountyDraft.required_mods
  );
  const [selectedDisallowedMods, setSelectedDisallowedMods] = useState<Mod[]>(
    bountyDraft.disallowed_mods
  );

  useEffect(() => {
    draftSelectBountyType(selectedType);
  }, [selectedType]);

  useEffect(() => {
    draftSelectRequiredMods(selectedRequiredMods);
  }, [selectedRequiredMods]);

  useEffect(() => {
    draftSelectDisallowedMods(selectedDisallowedMods);
  }, [selectedDisallowedMods]);

  return (
    <div className="flex flex-col w-full h-full space-y-2 place-content-between">
      <div className="flex flex-row rounded-xl bg-slate-800 w-fit h-fit items-center">
        <p className="text-2xl p-2 px-4">Step II.</p>
        <p className="text-xl font-thin p-2 px-4">Basic bounty requirements</p>
      </div>
      <div className="flex flex-col h-3/4 w-full space-y-4">
        <div className="flex flex-col rounded-xl bg-slate-800 w-full h-1/3 p-4 items-start place-content-between">
          <p className="text-xl">Click to select bounty type</p>
          <div className="flex flex-row space-x-4 items-center">
            <BountyTypePill
              type="FC"
              selected={selectedType == "FC"}
              clickAction={() => {
                setSelectedType("FC");
                draftSelectBountyType("FC");
                setSelectedDisallowedMods([
                  ...selectedDisallowedMods.filter((v) => v != "nf"),
                ]);
              }}
            />
            <p className="text-sm">
              A Full Combo means the map has been completed without dropping
              combo.
            </p>
          </div>
          <div className="flex flex-row space-x-4 items-center">
            <BountyTypePill
              type="Clear"
              selected={selectedType == "Clear"}
              clickAction={() => {
                setSelectedType("Clear");
                draftSelectBountyType("Clear");
                !selectedDisallowedMods.includes("nf")
                  ? setSelectedDisallowedMods([...selectedDisallowedMods, "nf"])
                  : null;
              }}
            />
            <p className="text-sm">
              A clear means the map has been completed without dying.
            </p>
          </div>
        </div>
        <div className="flex flex-col rounded-xl bg-slate-800 w-full h-1/3 p-4 px-4 items-start space-y-4">
          <p className="text-xl">Click to select required mods (max. 3)</p>
          <div className="flex flex-row space-x-2">
            <ModIcon
              mod="hd"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("hd")}
              clickAction={() => switchRequiredModFilter("hd")}
            />
            <ModIcon
              mod="hr"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("hr")}
              clickAction={() => switchRequiredModFilter("hr")}
            />
            <ModIcon
              mod="dt"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("dt")}
              clickAction={() => switchRequiredModFilter("dt")}
            />
            <ModIcon
              mod="ez"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("ez")}
              clickAction={() => switchRequiredModFilter("ez")}
            />
            <ModIcon
              mod="fl"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("fl")}
              clickAction={() => switchRequiredModFilter("fl")}
            />
            <ModIcon
              mod="ht"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("ht")}
              clickAction={() => switchRequiredModFilter("ht")}
            />
            <ModIcon
              mod="sd"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("sd")}
              clickAction={() => switchRequiredModFilter("sd")}
            />
            <ModIcon
              mod="pf"
              width="w-10"
              grayed={!selectedRequiredMods?.includes("pf")}
              clickAction={() => switchRequiredModFilter("pf")}
            />
          </div>
          <p className="text-sm">
            Required mods must be applied for the score to count, but the player
            can chose to add other mods aswell.
          </p>
        </div>
        <div className="flex flex-col rounded-xl bg-slate-800 w-full h-1/3 p-4 px-4 items-start space-y-4">
          <p className="text-xl">Click to select disallowed mods</p>
          <div className="flex flex-row space-x-2">
            <ModIcon
              mod="hd"
              width="w-10"
              grayed={!selectedDisallowedMods?.includes("hd")}
              clickAction={() => switchDisallowedModFilter("hd")}
            />
            <ModIcon
              mod="hr"
              width="w-10"
              grayed={!selectedDisallowedMods?.includes("hr")}
              clickAction={() => switchDisallowedModFilter("hr")}
            />
            <ModIcon
              mod="dt"
              width="w-10"
              grayed={!selectedDisallowedMods?.includes("dt")}
              clickAction={() => switchDisallowedModFilter("dt")}
            />
            <ModIcon
              mod="ez"
              width="w-10"
              grayed={!selectedDisallowedMods?.includes("ez")}
              clickAction={() => switchDisallowedModFilter("ez")}
            />
            <ModIcon
              mod="ht"
              width="w-10"
              grayed={!selectedDisallowedMods?.includes("ht")}
              clickAction={() => switchDisallowedModFilter("ht")}
            />
            <ModIcon
              mod="nf"
              width="w-10"
              grayed={!selectedDisallowedMods?.includes("nf")}
              clickAction={() => switchDisallowedModFilter("nf")}
            />
          </div>
          <p className="text-sm">
            Disallowed mods cannot be used for the score to count.
          </p>
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
              setStep("beatmap");
            }}
            color="green"
          >
            Previous step
          </BasicButton>

          {selectedType != "Any" ? (
            <BasicButton
              onClick={() => {
                setStep("additional_requirements");
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
