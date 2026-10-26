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
  xs: "h-5 text-xs",
  sm: "h-6 text-xs",
  md: "h-8 text-sm",
  lg: "h-10 text-base",
};

// Official osu-web SVG artwork; see public/images/mods/README.md and LICENCE.
const icons = {
  EZ: { file: "easy", color: "#a3cf83" },
  NF: { file: "no-fail", color: "#a3cf83" },
  HT: { file: "half-time", color: "#a3cf83" },
  HD: { file: "hidden", color: "#ed8d83" },
  HR: { file: "hard-rock", color: "#ed8d83" },
  DT: { file: "double-time", color: "#ed8d83" },
  FL: { file: "flashlight", color: "#ed8d83" },
  SO: { file: "spun-out", color: "#83bfcf" },
  NM: { file: "no-mod", color: "#bebc99" },
} satisfies Record<Exclude<ModAcronym, "ANY">, { file: string; color: string }>;

function mask(file: string) {
  const value = `url(/images/mods/${file}.svg) center / contain no-repeat`;
  return { mask: value, WebkitMask: value };
}

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
  const name = modNames[mod] ?? mod;
  const label = crossed ? `${name} forbidden` : name;
  const icon = mod === "ANY" ? undefined : icons[mod];

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`relative inline-flex aspect-[120/84] shrink-0 items-center justify-center font-bold leading-none tracking-wide ${sizes[size]} ${!icon ? "rounded-md border border-border bg-background" : ""} ${className}`}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-px inset-x-[1.4286px]"
        >
          <span
            className="absolute inset-0"
            style={{ ...mask("mod-icon"), backgroundColor: icon.color }}
          />
          <span
            className="absolute inset-0 bg-surface"
            style={mask(`mod-${icon.file}`)}
          />
        </span>
      ) : (
        <span aria-hidden="true">{mod === "ANY" ? "?" : mod}</span>
      )}
      {crossed && (
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full text-danger"
        >
          <line
            x1="12"
            y1="88"
            x2="88"
            y2="12"
            stroke="var(--color-surface)"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="12"
            y1="88"
            x2="88"
            y2="12"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </span>
  );
}
