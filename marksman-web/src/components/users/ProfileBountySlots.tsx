import { UserHuntedBounties } from "@marksman/contracts";
import BountyCard from "../bounties/BountyCard";
import { aes_font } from "@/lib/fonts";

export default function ProfileBountySlots({
  hunts,
}: {
  hunts: UserHuntedBounties;
}) {
  const slots = [];

  for (let index = 0; index < 2; index++) {
    const slotIdx = index + 1;
    slots.push(
      <div
        className="relative flex min-h-56 min-w-0 w-full lg:flex-1 items-stretch justify-center rounded border border-border bg-card p-2"
        key={slotIdx}
      >
        <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 rounded border border-border bg-card px-3 py-1 text-sm font-bold whitespace-nowrap text-foreground-muted">
          Hunting Slot #{slotIdx}
        </span>

        {hunts[index] ? (
          <BountyCard bounty={hunts[index].bounty} />
        ) : (
          <div className="flex w-full items-center justify-center rounded border border-border/30 bg-card-darker shadow-[inset_0_2px_8px_rgb(0_0_0/0.7)]">
            <span
              className={`text-center text-3xl text-foreground-muted/20 ${aes_font.className} font-bold`}
            >
              Empty Hunting Slot
            </span>
          </div>
        )}
      </div>,
    );
  }

  return slots;
}
