import { aes_font } from "@/lib/fonts";

export default function PageHeaderBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h1
      className={`text-xl sm:text-3xl font-bold text-foreground-muted bg-surface px-4 p-2 rounded border border-border ${aes_font.className} w-full max-w-2xl text-center`}
    >
      {children}
    </h1>
  );
}
