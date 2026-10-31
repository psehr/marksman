"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useBeatmapMetadata } from "@/hooks/useBeatmapMetadata";
import { InfoSection } from "@/components/ui/InfoSection";
import { useState } from "react";
import LoginStep from "./LoginStep";
import BeatmapStep from "./BeatmapStep";
import GoalStep from "./GoalStep";
import type { BeatmapStepProps, BountyCreationToolStep } from "./creation-tool.types";
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
          <GoalStep />
        </>
      ) : null}
    </InfoSection>
  );
}
