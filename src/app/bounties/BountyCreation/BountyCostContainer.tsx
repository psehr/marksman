import { Bounty } from "@/src/_models/bounty";
import { bounty_base_cost } from "@/src/_utils/maths";

export default function BountyCostContainer(props: { bountyDraft: Bounty }) {
  return (
    <div className="flex flex-row rounded-lg bg-yellow-700 border-2 border-yellow-600 w-full h-fit items-center">
      <div className="flex flex-row space-x-1 p-2 px-4">
        <p className="">Est. bounty creation cost: </p>
        <div className="flex flex-row space-x-2">
          <p>
            🪙
            {(
              bounty_base_cost(props.bountyDraft) + props.bountyDraft.reward
            ).toLocaleString("en-US")}
          </p>
        </div>
      </div>
    </div>
  );
}
