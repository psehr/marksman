import type { OsuGrade } from "@marksman/contracts";

type Grade = Exclude<OsuGrade, "F">;

const grades = {
  D: { file: "D", label: "D" },
  C: { file: "C", label: "C" },
  B: { file: "B", label: "B" },
  A: { file: "A", label: "A" },
  S: { file: "S", label: "S" },
  SH: { file: "S-Silver", label: "Silver S" },
  X: { file: "SS", label: "SS" },
  XH: { file: "SS-Silver", label: "Silver SS" },
} satisfies Record<Grade, { file: string; label: string }>;

const sizes = { sm: "h-4", md: "h-6", lg: "h-8" };

/** Official osu-web artwork; attribution lives in public/images/grades. */
export default function GradeIcon({
  grade,
  size = "md",
  minimum = false,
  className = "",
}: {
  grade: Grade;
  size?: keyof typeof sizes;
  minimum?: boolean;
  className?: string;
}) {
  const icon = grades[grade];
  const label = `${minimum ? "Minimum grade" : "Grade"}: ${icon.label}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center gap-1 ${sizes[size]} ${className}`}
    >
      {minimum && <span aria-hidden="true" className="font-bold"></span>}
      <span
        aria-hidden="true"
        className="block h-full aspect-2/1 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(/images/grades/GradeSmall-${icon.file}.svg)`,
        }}
      />
    </span>
  );
}
