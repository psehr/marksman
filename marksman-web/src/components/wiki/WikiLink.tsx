"use client";

import Link from "next/link";

export function WikiLink({
  children,
  url,
}: {
  children: React.ReactNode;
  url: string;
}) {
  return (
    <Link onNavigate={() => window.dispatchEvent(new CustomEvent("wiki-section-navigation", { detail: url }))} href={url} className="underline text-foreground-muted">
      {children}
    </Link>
  );
}
