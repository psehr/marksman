import type { ExtendedBounty, OsuBeatmapMetadata, OsuGrade, User } from "@marksman/contracts";

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

export type GoalStepProps = {
  selectedBountyType: BountyType;
  selectedMinimumGrade: Exclude<OsuGrade, "F" | "SH" | "XH">;
  selectedMinimumComboPercentage: number;
  requireMinimumAccuracy: boolean;
  selectedMinimumAccuracy: number;
  setRequireMinimumAccuracy: (enabled: boolean) => void;
  setSelectedMinimumAccuracy: (accuracy: number) => void;
  setSelectedBountyType: (type: BountyType) => void;
  setSelectedMinimumGrade: (
    grade: Exclude<OsuGrade, "F" | "SH" | "XH">,
  ) => void;
  setSelectedMinimumComboPercentage: (ratio: number) => void;
  beatmapMaxCombo: number | null;
  onBack: () => void;
  onContinue: () => void;
};

export type ModRequirement = ExtendedBounty["goal"]["modRequirement"];
export type ModRule = ModRequirement["rule"];
export type SelectedMod = Extract<ModRequirement, { mods: unknown }>["mods"][number];

export type ModsStepProps = {
  selectedModRule: ModRule;
  selectedMods: SelectedMod[];
  setSelectedModRule: (rule: ModRule) => void;
  onModToggle: (mod: SelectedMod, checked: boolean) => void;
  validationErrors: string[];
  onBack: () => void;
  onContinue: () => void;
};

export type BountyType = "minimum_grade" | "full_combo";

export type BountyCreationToolStep =
  | "login"
  | "beatmap"
  | "goal"
  | "mods"
  | "reward"
  | "review";

export type BeatmapValidationInput = Pick<
  BeatmapStepProps,
  "beatmapInput" | "beatmapLookupStatus" | "beatmapMetadata"
>;
