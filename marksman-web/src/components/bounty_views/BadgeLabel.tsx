export function BadgeLabel({
  label,
  text,
}: {
  label: string;
  text: React.ReactNode;
}) {
  return (
    <span
      title={label}
      className={`border-border bg-surface relative inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-xs border px-2 text-xs leading-none font-bold tracking-wide`}
    >
      {text}
    </span>
  );
}
