import { BountyTier } from "@/src/_models/bounty";

// export function RewardTierFromRewardGold(gold: number) {
//   let tier = 1;
//   if (gold >= 5000) tier = 2;
//   if (gold >= 10000) tier = 3;
//   if (gold >= 15000) tier = 4;
//   if (gold >= 20000) tier = 5;
//   if (gold >= 35000) tier = 6;
//   if (gold >= 50000) tier = 7;
//   if (gold >= 75000) tier = 8;
//   if (gold >= 100000) tier = 9;

//   return tier;
// }

export function RewardTierFromRewardGold(gold: number): BountyTier {
  let tier = "Common";
  if (gold >= 10000) tier = "Uncommon";
  if (gold >= 20000) tier = "Rare";
  if (gold >= 50000) tier = "Epic";
  if (gold >= 100000) tier = "Legendary";

  return tier as BountyTier;
}

export const rewardTierColors = (tier: BountyTier) => {
  let bg_color = "bg-gray-600";
  let border_color = "border-none";
  if (tier == "Uncommon") {
    bg_color = "bg-blue-900";
    border_color = "border-blue-800";
  }
  if (tier == "Rare") {
    bg_color = "bg-green-900";
    border_color = "border-green-800";
  }
  if (tier == "Epic") {
    bg_color = "bg-purple-900";
    border_color = "border-purple-700";
  }
  if (tier == "Legendary") {
    bg_color = "bg-yellow-600";
    border_color = "border-yellow-600";
  }

  return {
    bg_color: bg_color,
    border_color: border_color,
  };
};

export function RewardTierPill({
  tier,
  grayed,
  clickAction,
}: {
  tier: BountyTier;
  grayed?: boolean;
  clickAction?: any;
}) {
  let bg_color = rewardTierColors(tier).bg_color;
  let text = "Common";
  if (tier == "Uncommon") {
    text = "Uncommon";
  }
  if (tier == "Rare") {
    text = "Rare";
  }
  if (tier == "Epic") {
    text = "Epic";
  }
  if (tier == "Legendary") {
    text = "Legendary";
  }
  return (
    <p
      className={`select-none text-[2vw] md:text-xs font-extrabold shadow-lg rounded-lg md:p-1 px-1 md:px-2  w-fit h-fit ${bg_color} ${
        grayed ? "brightness-[50%]" : ""
      } ${clickAction ? "cursor-pointer" : ""}`}
      onClick={clickAction}
    >
      {text}
    </p>
  );
}
