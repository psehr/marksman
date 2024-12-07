import { Bounty } from "@/src/_models/bounty";
import { gold_to_experience } from "@/src/_utils/maths";

export function BountyRewardPill({ bounty }: { bounty: Bounty }) {
  const gold_reward = bounty.reward;
  const days_elapsed = Math.floor(
    (Date.now() - bounty.timestamp) / 1000 / 86400
  );

  return (
    <div className="shadow-lg flex flex-row h-full bg-green-800/90 p-1 px-2 rounded-xl space-x-1 place-content-between items-center min-w-16">
      <p>🪙</p>
      <p>{bounty.reward.toLocaleString("en-US")}</p>
    </div>
  );
}
