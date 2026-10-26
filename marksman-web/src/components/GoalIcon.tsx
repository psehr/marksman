import type { ExtendedBounty } from "@marksman/contracts";
import GradeIcon from "./GradeIcon";

const sizes = {
  sm: "h-6 min-w-8 px-1 text-xs",
  md: "h-8 min-w-10 px-1.5 text-sm",
  lg: "h-10 min-w-12 px-2 text-base",
};

type GoalIconProps = {
  goal: ExtendedBounty["goal"];
  size?: keyof typeof sizes;
  className?: string;
};

/** Goal badge: FC for full combo, or the minimum required grade. */
export default function GoalIcon({
  goal,
  size = "md",
  className = "",
}: GoalIconProps) {
  if (goal.type === "minimum_grade") {
    return <GradeIcon grade={goal.minimumGradeRequirement} minimum size={size} className={className} />;
  }
  const label = "Full combo required";
  const badge = "FC";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-md border border-white/25 bg-slate-900 font-bold leading-none tracking-wide text-white ${sizes[size]} ${className}`}
    >
      <span aria-hidden="true">{badge}</span>
    </span>
  );
}
