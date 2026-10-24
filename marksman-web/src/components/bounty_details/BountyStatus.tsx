import { ExtendedBounty } from "@marksman/contracts";

export default function BountyStatus({ bounty }: { bounty: ExtendedBounty }) {
  switch (bounty.status) {
    case "open":
      return (
        <div className="grid grid-cols-2 w-full">
          <section className="flex w-full place-content-center">
            <p className="w-fit text-2xl font-bold bg-green-400/30 border border-dashed py-2 px-8 rounded">
              OPEN
            </p>
          </section>
          <section className="flex w-full place-content-center items-center">
            <p className="w-fit">
              {bounty.engagement.bookmarkCount} player(s) bookmarked
            </p>
          </section>
        </div>
      );
    case "completed":
      return (
        <div className="flex w-full place-content-center">
          <p className="w-fit text-2xl font-bold bg-blue-400/30 border border-dashed py-2 px-8 rounded">
            COMPLETED
          </p>
        </div>
      );
    case "cancelled":
      return (
        <div className="flex w-full place-content-center">
          <p className="w-fit text-2xl font-bold bg-red-400/30 border border-dashed py-2 px-8 rounded">
            CANCELLED
          </p>
        </div>
      );
  }
}
