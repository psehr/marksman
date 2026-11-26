import TargetIcon from "../ui/TargetIcon";

export default function BountyHuntStamps({
  count,
  seed = "bounty",
}: {
  count: number;
  seed?: string;
}) {
  if (count === 0) return null;

  let hash = 0;
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  const positions = Array.from({ length: count }, () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    const left = 8 + (hash % 85);
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    return { left: `${left}%`, top: `${25 + (hash % 45)}%` };
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <span className="sr-only">
        {count} ongoing {count === 1 ? "hunter" : "hunters"}
      </span>

      <div aria-hidden="true" className="absolute inset-0 opacity-15">
        {positions.map((position, index) => (
          <span
            key={index}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center text-accent"
            style={position}
          >
            <TargetIcon size="lg" />
          </span>
        ))}
      </div>
    </div>
  );
}
