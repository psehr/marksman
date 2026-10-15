import type { ExtendedBounty } from "@marksman/contracts";

type RequiredMod = Extract<
  ExtendedBounty["goal"]["modRequirement"],
  { mods: unknown }
>["mods"][number];

type ModAcronym = RequiredMod | "NM" | "ANY";

const modNames = {
  EZ: "Easy",
  HD: "Hidden",
  HR: "Hard Rock",
  DT: "Double Time",
  HT: "Half Time",
  FL: "Flashlight",
  NF: "No Fail",
  SO: "Spun Out",
  NM: "No mods",
  ANY: "Any mods",
} satisfies Record<ModAcronym, string>;

const sizes = {
  sm: "h-6 min-w-8 px-1 text-xs",
  md: "h-8 min-w-10 px-1.5 text-sm",
  lg: "h-10 min-w-12 px-2 text-base",
};

type ModIconProps = {
  mod: ModAcronym;
  size?: keyof typeof sizes;
  crossed?: boolean;
  className?: string;
};

/** Standalone mod badge. NM means no mods; ANY represents an unrestricted rule. */
export default function ModIcon({
  mod,
  size = "md",
  crossed = false,
  className = "",
}: ModIconProps) {
  const name = modNames[mod];
  const label = crossed ? `${name} forbidden` : name;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-md border border-white/25 bg-slate-900 font-bold leading-none tracking-wide text-white ${sizes[size]} ${className}`}
    >
      <span aria-hidden="true">{mod === "ANY" ? "?" : mod}</span>
      {crossed && (
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full text-red-400"
        >
          <line
            x1="12"
            y1="88"
            x2="88"
            y2="12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </span>
  );
}
