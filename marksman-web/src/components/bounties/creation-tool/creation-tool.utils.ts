import type {
  BeatmapValidationInput,
  BeatmapValidity,
  BountyCreationToolStep,
} from "./creation-tool.types";

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

export function formatStepTitle(step: BountyCreationToolStep): string {
  switch (step) {
    case "login":
      return "Authentication Status (1/6)";
    case "beatmap":
      return "Beatmap Selection (2/6)";
    case "goal":
      return "Completion Goal (3/6)";
    case "mods":
      return "Mod Requirements (4/6)";
    case "reward":
      return "Reward Selection (5/6)";
    default:
      return "Info Section";
  }
}

export function isSelectedBeatmapValid(
  props: BeatmapValidationInput,
): BeatmapValidity {
  const reasons: string[] = [];
  const beatmapId = beatmapIdFromInput(props.beatmapInput);

  if (!beatmapId) {
    reasons.push("Invalid beatmap URL or ID provided.");
  }

  if (props.beatmapLookupStatus !== "success") {
    reasons.push("Lookup did not finish yet.");
  }

  if (!props.beatmapMetadata || props.beatmapMetadata.id !== beatmapId) {
    reasons.push("Error, no corresponding beatmap metadata available.");
  }

  if (props.beatmapMetadata && props.beatmapMetadata.mode !== "osu") {
    reasons.push("Only osu!standard beatmaps are supported.");
  }

  if (
    props.beatmapMetadata &&
    !["ranked", "approved", "loved"].includes(props.beatmapMetadata.status)
  ) {
    reasons.push("Only Ranked, Approved or Loved beatmaps are supported.");
  }

  const status = reasons.length === 0 ? "valid" : "invalid";
  return status === "valid"
    ? { status: "valid" }
    : { status: "invalid", reasons };
}

export function rewardFee(reward: number) {
  const FEE_PERCENTAGE = 10;
  return Math.ceil(reward * (FEE_PERCENTAGE / 100));
}

export function evaluateRewardValidity(
  balance: number | null,
  reward: number,
): { status: "valid" } | { status: "invalid"; reasons: string[] } {
  const reasons: string[] = [];
  const cost = reward + rewardFee(reward);

  if (balance === null) {
    reasons.push("Unable to fetch user balance.");
  } else if (balance < cost) {
    reasons.push("Insufficient BP balance.");
  }

  if (reward <= 0) {
    reasons.push("Reward must be positive.");
  }

  if (!Number.isInteger(reward)) {
    reasons.push("Reward must be an integer.");
  }

  const status = reasons.length === 0 ? "valid" : "invalid";
  return status === "valid"
    ? { status: "valid" }
    : { status: "invalid", reasons };
}
