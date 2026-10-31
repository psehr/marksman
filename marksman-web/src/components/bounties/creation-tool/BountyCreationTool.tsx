"use client";

import { AuthButton } from "@/components/auth/AuthButton";
import { useAuth } from "@/components/auth/AuthProvider";
import Button from "@/components/ui/Button";
import { useState } from "react";
import LoginStep from "./LoginStep";
import { OsuBeatmapMetadata, User } from "@marksman/contracts";
import BeatmapStep from "./BeatmapStep";
import { useBeatmapMetadata } from "@/hooks/useBeatmapMetadata";
import { InfoSection } from "@/components/ui/InfoSection";

export function beatmapIdFromInput(input: string): number | undefined {
  const value = input.trim();
  let digits: string | undefined;
  if (/^\d+$/.test(value)) {
    digits = value;
  } else {
    try {
      const url = new URL(value);
      if (url.hostname !== "osu.ppy.sh" || url.protocol !== "https:") return;
      digits = /^\/(?:beatmaps|b)\/(\d+)\/?$/.exec(url.pathname)?.[1];
      if (!digits && /^\/beatmapsets\/\d+\/?$/.test(url.pathname)) {
        digits = /^#(?:osu|taiko|fruits|mania)\/(\d+)$/.exec(url.hash)?.[1];
      }
    } catch {
      return;
    }
  }
  const id = Number(digits);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export type LoginStepProps = {
  accountLoading: boolean;
  accountError: string | null;
  refreshUser: () => Promise<void>;
  onContinue: () => void;
  user: User | null;
};

type BeatmapValidity =
  | { status: "valid" }
  | { status: "invalid"; reasons: string[] };

export type BeatmapStepProps = {
  beatmapInput: string;
  onBeatmapChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  beatmapMetadata: OsuBeatmapMetadata | null;
  beatmapLookupStatus: "idle" | "loading" | "success" | "error";
  beatmapLookupError: string | null;
  retryLookup: () => void;
  beatmapValidity: BeatmapValidity;
  invalidInput: boolean;
};

export default function BountyCreationTool() {
  const FEE_PERCENTAGE = 10;
  const FEE_MULT = FEE_PERCENTAGE / 100;
  type BountyCreationToolStep =
    | "login"
    | "beatmap"
    | "goal"
    | "reward"
    | "review";

  const [currentStep, setCurrentStep] =
    useState<BountyCreationToolStep>("login");

  function formatStepTitle(step: BountyCreationToolStep): string {
    switch (step) {
      case "login":
        return "Authentication Status";
      case "beatmap":
        return "Beatmap Selection";
      default:
        return "Info Section";
    }
  }

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

  function isSelectedBeatmapValid(): BeatmapValidity {
    const reasons: string[] = [];

    if (!beatmapId) {
      reasons.push("Invalid beatmap URL or ID provided.");
    }

    if (beatmapLookupStatus !== "success") {
      reasons.push("Lookup did not finish yet.");
    }

    if (!beatmapMetadata || beatmapMetadata.id !== beatmapId) {
      reasons.push("Error, no corresponding beatmap metadata available.");
    }

    if (beatmapMetadata && beatmapMetadata.mode !== "osu") {
      reasons.push("Only osu!standard beatmaps are supported.");
    }

    if (
      beatmapMetadata &&
      !["ranked", "approved", "loved"].includes(beatmapMetadata.status)
    ) {
      reasons.push("Only Ranked, Approved or Loved beatmaps are supported.");
    }

    const status = reasons.length === 0 ? "valid" : "invalid";
    return status === "valid"
      ? { status: "valid" }
      : { status: "invalid", reasons };
  }

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
          <BeatmapStep
            props={{
              beatmapInput,
              onBeatmapChange: (input: string) => setBeatmapInput(input),
              onBack: () => setCurrentStep("login"),
              onContinue: () => {
                const validity = isSelectedBeatmapValid();
                if (validity.status === "valid") setCurrentStep("goal");
              },
              beatmapMetadata,
              beatmapLookupStatus,
              beatmapLookupError,
              retryLookup,
              beatmapValidity: isSelectedBeatmapValid(),
              invalidInput: beatmapId === undefined,
            }}
          />
        </>
      ) : null}
    </InfoSection>
  );
}
