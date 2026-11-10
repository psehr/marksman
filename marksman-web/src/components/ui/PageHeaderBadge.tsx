import { aes_font } from "@/lib/fonts";
import ActionIcon from "./ActionIcon";
import type { ComponentProps } from "react";

export default function PageHeaderBadge({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: ComponentProps<typeof ActionIcon>["action"];
}) {
  return (
    <h1
      className={`flex items-center justify-center gap-3 text-xl sm:text-3xl font-bold text-foreground-muted bg-surface px-4 p-2 rounded border border-border ${aes_font.className} w-full max-w-2xl text-center`}
    >
      {icon ? <ActionIcon action={icon} /> : null}
      <span className="min-w-0">{children}</span>
    </h1>
  );
}
