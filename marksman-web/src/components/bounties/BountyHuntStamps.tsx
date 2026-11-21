import TargetIcon from "../ui/TargetIcon";

export default function BountyHuntStamps({ count }: { count: number }) {
  if (count === 0) return null;

  const visibleCount = Math.min(count, 3);
  const remaining = count - visibleCount;

  return (
    <div className="pointer-events-none">
      <span className="sr-only">
        {count} ongoing {count === 1 ? "hunter" : "hunters"}
      </span>

      <div aria-hidden="true" className="flex items-center">
        {Array.from({ length: visibleCount }, (_, index) => (
          <span
            key={index}
            className={`flex size-fit shrink-0 items-center justify-center text-accent`}
          >
            <TargetIcon size="md" />
          </span>
        ))}

        {remaining > 0 && (
          <span className="pl-2 text-xs font-bold text-accent">
            +{remaining.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
