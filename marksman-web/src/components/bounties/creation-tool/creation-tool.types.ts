import type { OsuBeatmapMetadata, User } from "@marksman/contracts";

export type LoginStepProps = {
  accountLoading: boolean;
  accountError: string | null;
  refreshUser: () => Promise<void>;
  onContinue: () => void;
  user: User | null;
};

export type BeatmapValidity =
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

export type BountyCreationToolStep =
  | "login"
  | "beatmap"
  | "goal"
  | "reward"
  | "review";

export type BeatmapValidationInput = Pick<
  BeatmapStepProps,
  "beatmapInput" | "beatmapLookupStatus" | "beatmapMetadata"
>;

