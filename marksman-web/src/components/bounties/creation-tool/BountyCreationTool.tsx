"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useBeatmapMetadata } from "@/hooks/useBeatmapMetadata";
import { InfoSection } from "@/components/ui/InfoSection";
import { useState } from "react";
import LoginStep from "./LoginStep";
import BeatmapStep from "./BeatmapStep";
import GoalStep from "./GoalStep";
import ModsStep from "./ModsStep";
import {
  ExtendedBounty,
  modRequirementSchema,
  osuBeatmapMetadatatoBountyBeatmapMetadata,
} from "@marksman/contracts";
import type {
  BeatmapStepProps,
  BountyCreationToolStep,
  BountyType,
  GoalStepProps,
  ModRule,
  SelectedMod,
  ModsStepProps,
  RewardStepProps,
} from "./creation-tool.types";
import {
  beatmapIdFromInput,
  evaluateRewardValidity,
  formatStepTitle,
  isSelectedBeatmapValid,
} from "./creation-tool.utils";
import RewardStep from "./RewardStep";
import { BountyCardDisplay } from "../BountyCard";
import BountyPreview from "./BountyPreview";
import { aes_font } from "@/lib/fonts";

export default function BountyCreationTool() {
  const [currentStep, setCurrentStep] =
    useState<BountyCreationToolStep>("login");

  const {
    user,
    loading: accountLoading,
    error: accountError,
    refreshUser,
  } = useAuth();

  const loginProps = {
    user,
    accountLoading,
    accountError,
    refreshUser,
    onContinue: () => setCurrentStep("beatmap"),
  };

  const [beatmapInput, setBeatmapInput] = useState<string>("");
  const beatmapId = beatmapIdFromInput(beatmapInput);

  const {
    beatmapMetadata,
    beatmapLookupStatus,
    beatmapLookupError,
    retryLookup,
  } = useBeatmapMetadata(beatmapId);

  const beatmapValidity = isSelectedBeatmapValid({
    beatmapInput,
    beatmapLookupStatus,
    beatmapMetadata,
  });

  const beatmapStepProps: BeatmapStepProps = {
    beatmapInput,
    onBeatmapChange: (input: string) => setBeatmapInput(input),
    onBack: () => setCurrentStep("login"),
    onContinue: () => {
      if (beatmapValidity.status === "valid") setCurrentStep("goal");
    },
    beatmapMetadata,
    beatmapLookupStatus,
    beatmapLookupError,
    retryLookup,
    beatmapValidity,
    invalidInput: beatmapId === undefined,
  };

  const [selectedBountyType, setSelectedBountyType] =
    useState<BountyType>("full_combo");

  const [selectedMinimumGrade, setSelectedMinimumGrade] =
    useState<GoalStepProps["selectedMinimumGrade"]>("A");

  const [selectedMinimumComboPercentage, setSelectedMinimumComboPercentage] =
    useState(99);
  const [requireMinimumAccuracy, setRequireMinimumAccuracy] = useState(false);
  const [selectedMinimumAccuracy, setSelectedMinimumAccuracy] = useState(95);

  const goalStepProps: GoalStepProps = {
    selectedBountyType,
    selectedMinimumComboPercentage,
    selectedMinimumGrade,
    requireMinimumAccuracy,
    selectedMinimumAccuracy,
    setRequireMinimumAccuracy,
    setSelectedMinimumAccuracy,
    setSelectedBountyType,
    setSelectedMinimumGrade,
    setSelectedMinimumComboPercentage,
    beatmapMaxCombo: beatmapMetadata?.max_combo ?? null,
    onBack: () => setCurrentStep("beatmap"),
    onContinue: () => setCurrentStep("mods"),
  };

  const [selectedModRule, setSelectedModRule] = useState<ModRule>("any");
  const [selectedMods, setSelectedMods] = useState<SelectedMod[]>([]);
  const modValidation = modRequirementSchema.safeParse(
    selectedModRule === "any"
      ? { rule: "any" }
      : { rule: selectedModRule, mods: selectedMods },
  );

  const modsStepProps: ModsStepProps = {
    selectedModRule,
    selectedMods,
    setSelectedModRule,
    onModToggle: (mod, checked) =>
      setSelectedMods((current) =>
        checked
          ? current.includes(mod)
            ? current
            : [...current, mod]
          : current.filter((value) => value !== mod),
      ),
    validationErrors: modValidation.success
      ? []
      : modValidation.error.issues.map((issue) => issue.message),
    onBack: () => setCurrentStep("goal"),
    onContinue: () => {
      if (modValidation.success) setCurrentStep("reward");
    },
  };

  const [reward, setReward] = useState(25);
  const balance = user?.stats.bpBalance ?? null;
  const rewardValidity = evaluateRewardValidity(balance, reward);
  const isRewardValid = rewardValidity.status === "valid";
  const validationErrors =
    rewardValidity.status === "invalid" ? rewardValidity.reasons : [];

  const rewardStepProps: RewardStepProps = {
    balance,
    reward,
    setReward,
    isRewardValid,
    validationErrors,
    onBack: () => setCurrentStep("mods"),
    onContinue: () => setCurrentStep("review"),
  };

  let previewCardContent: BountyCardDisplay | null = null;
  if (beatmapMetadata) {
    const modRequirement: ExtendedBounty["goal"]["modRequirement"] =
      selectedModRule === "any"
        ? { rule: "any" }
        : { rule: selectedModRule, mods: selectedMods };

    const sharedGoalFields = {
      beatmapId: beatmapMetadata.id,
      beatmapChecksum: beatmapMetadata.checksum,
      modRequirement,
      minimumAccuracy: requireMinimumAccuracy
        ? selectedMinimumAccuracy
        : undefined,
    };

    const previewGoal: ExtendedBounty["goal"] =
      selectedBountyType === "full_combo"
        ? {
            ...sharedGoalFields,
            type: "full_combo",
            minimumComboRatio: selectedMinimumComboPercentage / 100,
          }
        : {
            ...sharedGoalFields,
            type: "minimum_grade",
            minimumGradeRequirement: selectedMinimumGrade,
          };

    previewCardContent = {
      beatmap: osuBeatmapMetadatatoBountyBeatmapMetadata(beatmapMetadata),
      goal: previewGoal,
      rewardBp: Number.isInteger(reward) && reward > 0 ? reward : null,
    };
  }

  return (
    <>
      {previewCardContent ? (
        <div className="w-full max-w-3xl text-end">
          <h1
            className={`text-2xl font-bold text-foreground-muted ${aes_font.className}`}
          >
            Bounty Preview
          </h1>
          <BountyPreview content={previewCardContent} />
        </div>
      ) : null}
      <div className="w-full max-w-3xl text-end">
        <h1
          className={`text-2xl font-bold text-foreground-muted ${aes_font.className}`}
        >
          {formatStepTitle(currentStep)}
        </h1>
        <div className="bg-surface border border-border rounded p-4">
          {currentStep === "login" ? <LoginStep props={loginProps} /> : null}
          {currentStep === "beatmap" ? (
            <BeatmapStep props={beatmapStepProps} />
          ) : null}
          {currentStep === "goal" ? <GoalStep props={goalStepProps} /> : null}
          {currentStep === "mods" ? <ModsStep props={modsStepProps} /> : null}
          {currentStep === "reward" ? (
            <RewardStep props={rewardStepProps} />
          ) : null}
        </div>
      </div>
    </>
  );
}
