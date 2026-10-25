const bountyTiers = [
  { name: "Phantasm", minimumBp: 10_000 },
  { name: "Extra", minimumBp: 3_000 },
  { name: "Lunatic", minimumBp: 1_000 },
  { name: "Hard", minimumBp: 300 },
  { name: "Normal", minimumBp: 100 },
  { name: "Easy", minimumBp: 1 },
] as const;

export type BountyTier = (typeof bountyTiers)[number]["name"];

export function getBountyTier(rewardBp: number): BountyTier {
  const tier = bountyTiers.find(({ minimumBp }) => rewardBp >= minimumBp);

  if (!tier) {
    throw new Error("Bounty reward must be at least 1 BP");
  }

  return tier.name;
}
