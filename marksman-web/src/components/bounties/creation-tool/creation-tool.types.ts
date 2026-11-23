import type {
  ExtendedBounty,
  OsuBeatmapMetadata,
  OsuGrade,
  User,
} from "@marksman/contracts";

export type LoginStepProps = {
  accountLoading: boolean;
  accountError: string | null;
  refreshUser: () => Promise<void>;
  user: User | null;
};

export type BeatmapValidity =
  | { status: "valid" }
  | { status: "invalid"; reasons: string[] };

export type BeatmapStepProps = {
  beatmapInput: string;
  onBeatmapChange: (value: string) => void;
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

  customizeStableComboThreshold: boolean;
  setCustomizeStableComboThreshold: (enabled: boolean) => void;
};

export type ModRequirement = ExtendedBounty["goal"]["modRequirement"];
export type ModRule = ModRequirement["rule"];
export type SelectedMod = Extract<
  ModRequirement,
  { mods: unknown }
>["mods"][number];

export type ModsStepProps = {
  bountyType: BountyType;
  selectedModRule: ModRule;
  selectedMods: SelectedMod[];
  setSelectedModRule: (rule: ModRule) => void;
  onModToggle: (mod: SelectedMod, checked: boolean) => void;
  validationErrors: string[];
};

export type RewardStepProps = {
  balance: number | null;
  reward: number;
  setReward: (reward: number) => void;
  validationErrors: string[];
};

export type BountyType = "minimum_grade" | "full_combo" | "pass";

export type BeatmapValidationInput = Pick<
  BeatmapStepProps,
  "beatmapInput" | "beatmapLookupStatus" | "beatmapMetadata"
>;
