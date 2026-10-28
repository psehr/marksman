const sizes = {
  sm: 16,
  md: 24,
  lg: 32,
  hero: "clamp(2.5rem, 6vw, 4.5rem)",
};

export default function TargetIcon({
  size = "md",
}: {
  size?: keyof typeof sizes;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 bg-current text-accent"
      style={{
        width: sizes[size],
        height: sizes[size],
        mask: "url('/images/target-arrow.svg') center / contain no-repeat",
      }}
    />
  );
}
