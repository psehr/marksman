"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useBeatmapMetadata } from "@/hooks/useBeatmapMetadata";
import { InfoSection } from "@/components/ui/InfoSection";
import { useState } from "react";
import LoginStep from "./LoginStep";
import BeatmapStep from "./BeatmapStep";
import GoalStep from "./GoalStep";
import ModsStep from "./ModsStep";
import { modRequirementSchema } from "@marksman/contracts";
import type {
  BeatmapStepProps,
  BountyCreationToolStep,
  BountyType,
  GoalStepProps,
  ModRule,
  SelectedMod,
  ModsStepProps,
} from "./creation-tool.types";
import {
  beatmapIdFromInput,
  formatStepTitle,
  isSelectedBeatmapValid,
} from "./creation-tool.utils";

export default function BountyCreationTool() {
  const [currentStep, setCurrentStep] =
    useState<BountyCreationToolStep>("login");

  const {
    user,
    loading: accountLoading,
    error: accountError,
    refreshUser,
  } = useAuth();

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
          ? current.includes(mod) ? current : [...current, mod]
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

  return (
    <InfoSection
      title={formatStepTitle(currentStep)}
      className="w-full max-w-2xl"
    >
      {currentStep === "login" ? (
        <>
          <LoginStep
            props={{
              user,
              accountLoading,
              accountError,
              refreshUser,
              onContinue: () => setCurrentStep("beatmap"),
            }}
          />
        </>
      ) : null}
      {currentStep === "beatmap" ? (
        <>
          <BeatmapStep props={beatmapStepProps} />
        </>
      ) : null}
      {currentStep === "goal" ? (
        <>
          <GoalStep props={goalStepProps} />
        </>
      ) : null}
      {currentStep === "mods" ? <ModsStep props={modsStepProps} /> : null}
    </InfoSection>
  );
}
