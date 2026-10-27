import { aes_font } from "@/lib/fonts";
import type { BountyTier } from "@marksman/contracts";

const tierStyles = {
  Easy: "border-[#a3cf83]/40 bg-[#a3cf83]/10 text-[#a3cf83]",
  Normal: "border-[#83bfcf]/40 bg-[#83bfcf]/10 text-[#83bfcf]",
  Hard: "border-[#efa85c]/40 bg-[#efa85c]/10 text-[#efa85c]",
  Lunatic: "border-[#ed8d83]/40 bg-[#ed8d83]/10 text-[#ed8d83]",
  Extra: "border-[#c4a3ed]/40 bg-[#c4a3ed]/10 text-[#c4a3ed]",
  Phantasm: "border-[#c4a3ed]/30 bg-card text-[#c4a3ed]",
} satisfies Record<BountyTier, string>;

const sizes = {
  sm: "h-6 px-2 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-10 px-4 text-base",
};

type BountyTierBadgeProps = {
  tier: BountyTier;
  size?: keyof typeof sizes;
  className?: string;
};

export default function BountyTierBadge({
  tier,
  size = "sm",
  className = "",
}: BountyTierBadgeProps) {
  return (
    <span
      title={`Reward tier: ${tier}`}
      className={`w-24 inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xs border font-bold leading-none tracking-wide ${tierStyles[tier]} ${sizes[size]} ${className} ${aes_font.className}`}
    >
      <span className="sr-only">Reward tier: </span>
      <span
        className={
          tier === "Phantasm"
            ? "bg-[linear-gradient(110deg,#ed8d83_0%,#efa85c_20%,#e6c65b_40%,#a3cf83_60%,#83bfcf_80%,#c4a3ed_100%)] bg-clip-text text-transparent forced-colors:bg-none forced-colors:text-[CanvasText]"
            : undefined
        }
      >
        {tier}
      </span>
    </span>
  );
}
