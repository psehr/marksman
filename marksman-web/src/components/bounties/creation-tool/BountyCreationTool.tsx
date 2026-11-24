"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useBeatmapMetadata } from "@/hooks/useBeatmapMetadata";
import { useState } from "react";
import LoginStep from "./LoginStep";
import BeatmapStep from "./BeatmapStep";
import GoalStep from "./GoalStep";
import ModsStep from "./ModsStep";
import {
  ExtendedBounty,
  createBountySchema,
  modSettingsSchema,
  osuBeatmapMetadatatoBountyBeatmapMetadata,
} from "@marksman/contracts";
import type {
  BeatmapStepProps,
  BountyType,
  GoalStepProps,
  ModsStepProps,
  RewardStepProps,
  ModRequirement,
} from "./creation-tool.types";
import {
  beatmapIdFromInput,
  evaluateRewardValidity,
  isSelectedBeatmapValid,
} from "./creation-tool.utils";
import RewardStep from "./RewardStep";
import CreationSubmit from "./CreationSubmit";
import { useBountyCreation } from "@/hooks/useBountyCreation";
import { BountyCardDisplay } from "../BountyCard";
import BountyPreview from "./BountyPreview";
import { aes_font } from "@/lib/fonts";

export default function BountyCreationTool() {
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

  const [customizeStableComboThreshold, setCustomizeStableComboThreshold] =
    useState(false);

  const goalStepProps: GoalStepProps = {
    selectedBountyType,
    selectedMinimumComboPercentage,
    selectedMinimumGrade,
    requireMinimumAccuracy,
    selectedMinimumAccuracy,
    setRequireMinimumAccuracy,
    setSelectedMinimumAccuracy,
    setSelectedBountyType: (type) => {
      if (type === "pass") {
        setModSettings((current) => ({
          ...current,
          required: current.required.filter((mod) => mod !== "NF"),
        }));
      }
      setSelectedBountyType(type);
    },
    setSelectedMinimumGrade,
    setSelectedMinimumComboPercentage,
    beatmapMaxCombo: beatmapMetadata?.max_combo ?? null,
    customizeStableComboThreshold,
    setCustomizeStableComboThreshold,
  };

  const [modSettings, setModSettings] = useState<ModRequirement>({
    required: [],
    forbidden: [],
    allowOtherMods: false,
  });

  const modValidation = modSettingsSchema.safeParse(modSettings);

  const modsStepProps: ModsStepProps = {
    bountyType: selectedBountyType,
    settings: modSettings,
    onModChange: (mod, selection) => {
      setModSettings((current) => {
        if (
          (selection === "required" &&
            selectedBountyType === "pass" &&
            mod === "NF") ||
          (selection === "forbidden" && !current.allowOtherMods)
        ) {
          return current;
        }

        const required = current.required.filter((value) => value !== mod);
        const forbidden = current.forbidden.filter((value) => value !== mod);

        return {
          ...current,
          required: selection === "required" ? [...required, mod] : required,
          forbidden:
            selection === "forbidden" ? [...forbidden, mod] : forbidden,
        };
      });
    },
    onAllowOtherModsChange: (allowed) => {
      setModSettings((current) => ({
        ...current,
        allowOtherMods: allowed,
        forbidden: !allowed
          ? []
          : current.required.includes("HT") || current.forbidden.includes("HT")
            ? current.forbidden
            : [...current.forbidden, "HT"],
      }));
    },
    validationErrors: modValidation.success
      ? []
      : modValidation.error.issues.map((issue) => issue.message),
  };

  const [reward, setReward] = useState(100);
  const balance = user?.stats.bpBalance ?? null;
  const rewardValidity = evaluateRewardValidity(balance, reward);
  const validationErrors =
    rewardValidity.status === "invalid" ? rewardValidity.reasons : [];

  const rewardStepProps: RewardStepProps = {
    balance,
    reward,
    setReward,
    validationErrors,
  };

  let previewCardContent: BountyCardDisplay | null = null;
  if (beatmapMetadata) {
    const sharedGoalFields = {
      beatmapId: beatmapMetadata.id,
      beatmapChecksum: beatmapMetadata.checksum,
      modRequirement: modSettings,
      minimumAccuracy: requireMinimumAccuracy
        ? selectedMinimumAccuracy
        : undefined,
    };

    const previewGoal: ExtendedBounty["goal"] =
      selectedBountyType === "full_combo"
        ? {
            ...sharedGoalFields,
            type: "full_combo",
            minimumComboRatio: customizeStableComboThreshold
              ? selectedMinimumComboPercentage / 100
              : 0.99,
          }
        : selectedBountyType === "minimum_grade"
          ? {
              ...sharedGoalFields,
              type: "minimum_grade",
              minimumGradeRequirement: selectedMinimumGrade,
            }
          : {
              ...sharedGoalFields,
              type: "pass",
            };

    previewCardContent = {
      beatmap: osuBeatmapMetadatatoBountyBeatmapMetadata(beatmapMetadata),
      goal: previewGoal,
      rewardBp: Number.isInteger(reward) && reward > 0 ? reward : null,
    };
  }

  const creation = useBountyCreation(refreshUser);
  const finalInput = createBountySchema.safeParse({
    rewardBp: reward,
    goal: previewCardContent?.goal,
  });
  const submissionErrors = [
    ...(finalInput.success || !previewCardContent
      ? []
      : finalInput.error.issues
          .filter(
            (issue) =>
              issue.path[0] !== "rewardBp" &&
              !(issue.path[0] === "goal" && issue.path[1] === "modRequirement"),
          )
          .map((issue) => issue.message)),
    ...(beatmapValidity.status === "valid"
      ? []
      : ["Choose an eligible beatmap above before creating the bounty."]),
  ];
  const canSubmit =
    finalInput.success &&
    rewardValidity.status === "valid" &&
    submissionErrors.length === 0 &&
    !accountLoading &&
    !accountError &&
    user !== null;

  const submissionProps = {
    input: finalInput.success ? finalInput.data : null,
    errors: [...new Set(submissionErrors)],
    pending: creation.pending,
    error: creation.error,
    canSubmit,
    onSubmit: () => {
      if (canSubmit && finalInput.success)
        void creation.submit(finalInput.data);
    },
  };

  if (!user || accountLoading || accountError) {
    return (
      <section className="w-full max-w-2xl bg-surface border border-border rounded p-4">
        <h2 className="text-lg font-bold mb-4">Authentication Status</h2>
        <LoginStep props={loginProps} />
      </section>
    );
  }

  const sections = [
    {
      title: "Beatmap Selection",
      content: <BeatmapStep props={beatmapStepProps} />,
    },
    { title: "Mod Requirements", content: <ModsStep props={modsStepProps} /> },
    { title: "Completion Goal", content: <GoalStep props={goalStepProps} /> },
    {
      title: "Reward Selection",
      content: (
        <div className="flex flex-col gap-4">
          <RewardStep props={rewardStepProps} />
          <CreationSubmit props={submissionProps} />
        </div>
      ),
    },
  ];

  return (
    <>
      {previewCardContent ? (
        <div className="w-full max-w-2xl text-end">
          <h2
            className={`text-lg sm:text-2xl font-bold text-foreground-muted ${aes_font.className}`}
          >
            Bounty Preview
          </h2>
          <BountyPreview content={previewCardContent} />
        </div>
      ) : null}
      <div className="flex w-full max-w-2xl flex-col gap-6">
        {sections.map(({ title, content }) => (
          <section
            key={title}
            aria-label={title}
            className="w-full min-w-0 text-end"
          >
            <h2
              className={`text-lg sm:text-2xl font-bold text-foreground-muted ${aes_font.className}`}
            >
              {title}
            </h2>
            <fieldset
              disabled={creation.pending}
              className="min-w-0 bg-surface border border-border rounded p-4"
            >
              <legend className="sr-only">{title}</legend>
              {content}
            </fieldset>
          </section>
        ))}
      </div>
    </>
  );
}
