"use client";

import Link from "next/link";

export function AboutLink({
  children,
  url,
}: {
  children: React.ReactNode;
  url: string;
}) {
  return (
    <Link onNavigate={() => window.dispatchEvent(new CustomEvent("about-section-navigation", { detail: url }))} href={url} className="underline text-foreground-muted">
      {children}
    </Link>
  );
}
