import { BeatmapSet, BeatmapVersion } from "./beatmap";
import { Grade, Mod } from "./score";
import { OsuUser } from "./user";

export function initBounty(): Bounty {
  return {
    id: "",
    timestamp: 0,
    title: "",
    creator: {
      id: 0,
      image: "",
      name: "",
      country_code: "",
    },
    beatmapset: {
      id: 0,
      url: "",
      metadata: { title: "", titleUnicode: "", artist: "", artistUnicode: "" },
      creator: {
        id: 0,
        image: "",
        name: "",
        country_code: "",
      },
      status: "wip",
      cover: "",
      slimcover: "",
      list: "",
      card: "",
      versions: [],
    },
    version: {
      id: 0,
      url: "",
      difficulty_name: "",
      metadata: { title: "", titleUnicode: "", artist: "", artistUnicode: "" },
      attributes: {
        star_rating: 0,
        bpm: 0,
        overall_difficulty: 0,
        approach_rate: 0,
        drain_length: 0,
        max_combo: 0,
      },
    },
    required_mods: [],
    disallowed_mods: [],
    type: "Any",
    minimum_grade: "D",
    minimum_accuracy: 0,
    sliderend_leniency: 5,
    reward: 5000,
    comments: [],
    stats: {
      upvotes: 0,
      downvotes: 0,
      reports: 0,
    },
    claimed: false,
    tier: "Common",
  };
}

export function initClaim(user: OsuUser, bounty_id: string): ClaimAttempt {
  return {
    timestamp: Date.now(),
    user: user,
    score_id: 0,
    bounty_id: bounty_id,
    beatmap_id: 0,
    results: {
      isValid: false,
      full_combo: {
        needsFC: false,
        isFC: false,
      },
      clear: {
        needsClear: false,
        isClear: false,
      },
      required_mods: {
        needsRequiredMods: false,
        hasRequiredMods: false,
      },
      disallowed_mods: {
        disallowsMods: false,
        lacksDisallowedMods: false,
      },
    },
  };
}

export type Bounty = {
  id: string;
  timestamp: number;
  title: string;
  creator: OsuUser;
  beatmapset: BeatmapSet;
  version: BeatmapVersion;
  required_mods: Mod[];
  disallowed_mods: Mod[];
  type: BountyType;
  minimum_grade: Grade;
  minimum_accuracy: number;
  sliderend_leniency: number;
  reward: number;
  comments: BountyComment[];
  stats: {
    upvotes: number;
    downvotes: number;
    reports: number;
  };
  claimed: boolean;
  tier: BountyTier;
};

export type BountyType = "Any" | "FC" | "Clear";
export type BountyTier =
  | "Any"
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary";

export type RecurringTask = {
  // ...
};

export type BountyComment = {
  timestamp: number;
  author: OsuUser;
  message: string;
};

export type BountyValidationResults = {
  isValid: boolean;
  full_combo: {
    needsFC: boolean;
    isFC: boolean;
  };
  clear: {
    needsClear: boolean;
    isClear: boolean;
  };
  required_mods: {
    needsRequiredMods: boolean;
    hasRequiredMods: boolean;
    required_mods?: Mod[];
  };
  disallowed_mods: {
    disallowsMods: boolean;
    lacksDisallowedMods: boolean;
    disallowed_mods?: Mod[];
  };
};

export type ClaimAttempt = {
  timestamp: number;
  user: OsuUser;
  score_id: number;
  bounty_id: string;
  beatmap_id: number;
  results: BountyValidationResults;
};

export type ClaimResults = {
  isFC: boolean; // is it an fc (taking leniency into account)
  isClear: boolean; // is it a pass
  hasRequiredMods: boolean; // if the play uses required mods
  lacksDisallowedMods: boolean; // if the play doesn't uses any disallowed mods (must be true)
  isValidBeatmap: boolean; // is the beatmap played corresponding to the bounty's beatmap
  isValidUser: boolean; // is the score_data played from the claiming user
  isTimestampValid: boolean; // has the score been set after bounty creation
};
