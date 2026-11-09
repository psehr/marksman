const colors = {
  primary: "border-border text-foreground-muted",
  danger: "border-danger text-danger",
  accent: "border-accent text-accent",
  info: "border-info text-info",
};

export type BadgeLabelColor = keyof typeof colors;

export function BadgeLabel({
  label,
  text,
  color = "primary",
  className,
}: {
  label: string;
  text: React.ReactNode;
  color?: BadgeLabelColor;
  className?: string;
}) {
  return (
    <span
      title={label}
      className={`${colors[color]} bg-surface relative inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-xs border px-2 text-xs leading-none font-bold tracking-wide ${className}`}
    >
      {text}
    </span>
  );
}
