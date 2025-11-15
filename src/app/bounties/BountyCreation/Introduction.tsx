import { BasicButton } from "@/src/_components/buttons";

export function Introduction({
  setStep,
  setBountyCreationModalDisplay,
}: {
  setStep: any;
  setBountyCreationModalDisplay: any;
}) {
  return (
    <div className="flex flex-col w-full h-full space-y-2 md:place-content-around">
      <div className="flex flex-col md:flex-row md:rounded-lg bg-slate-800 w-full h-full md:h-fit">
        <div className="flex flex-col w-full md:w-2/3">
          <p className="p-2 px-4">Welcome to the bounty creation tool!</p>
          <p className="text-sm font-light p-2 px-4">
            This tool will guide you through the process of creating your
            bounties, any player will be able to claim them and obtain the
            reward once the bounty is submitted.
          </p>
          <p className="text-sm font-light px-4">
            A bounty is a goal set by someone on a specific beatmap, once the
            goal has been reached by a player, he can attempt to claim the
            bounty and obtain the associated rewards.
          </p>
          <p className="text-sm font-light px-4">
            Following the multiple steps, you'll be able to see the creation
            progress using the bounty draft, aswell as the estimated gold amount
            that will be billed to you.
          </p>
          <p className="text-sm pt-2 px-4">A few guidelines to follow:</p>
          <p className="text-sm font-light px-4 ml-4">
            - The reward must be sufficiently high compared to your estimation
            of the bounty's difficulty to claim, however feel free to go as high
            as you want even if it's overkill.
          </p>
          <p className="text-sm font-light px-4 ml-4">
            - The bounty must be at least remotely doable for someone as of some
            day, go crazy but don't be stupid and pollute the listings.
          </p>
          <p className="text-sm p-2 px-4">
            To disclaim, any submission that goes against these guidelines can
            and will be removed from the listings without refund nor
            justification if it crosses the line.
          </p>
          <p className="p-2 px-4">Have fun creating bounties!</p>
        </div>
        <div className="hidden md:flex flex-col w-1/2 place-content-center items-center text-gray-400">
          <div className="flex flex-col w-fit h-fit space-y-4 items-center bg-slate-700 p-4 rounded-lg">
            <p className="text-xl hover:text-white cursor-pointer">
              What is a bounty?
            </p>
            <p className="text-xl hover:text-white cursor-pointer">
              What are the rewards?
            </p>
            <p className="text-xl hover:text-white cursor-pointer">
              How do I claim bounties?
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-row md:rounded-lg bg-slate-800 w-full h-16 p-4 px-4 items-center place-content-between">
        <BasicButton
          onClick={() => {
            setBountyCreationModalDisplay(false);
          }}
          color="red"
        >
          Cancel
        </BasicButton>
        <BasicButton
          onClick={() => {
            setStep("beatmap");
          }}
          color="green"
        >
          Next step
        </BasicButton>
      </div>
    </div>
  );
}
