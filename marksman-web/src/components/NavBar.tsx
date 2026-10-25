"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { AuthButton } from "./AuthButton";

function RouteLink({
  url,
  title,
  selected,
}: {
  url: string;
  title: string;
  selected: boolean;
}) {
  return (
    <Link
      href={url}
      className={`cursor-pointer ${selected ? "text-accent" : "text-foreground-muted"}`}
      aria-current={selected ? "page" : undefined}
    >
      {title}
    </Link>
  );
}

export default function NavBar() {
  const path = usePathname();
  const { user } = useAuth();

  return (
    <nav className="flex min-h-16 w-full flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-12">
      <div className="flex gap-3 sm:gap-8 items-center">
        <RouteLink url="/" title="Marksman" selected={path === "/"} />
        <p>•</p>
        <RouteLink
          url="/bounties"
          title="Bounties"
          selected={path.startsWith("/bounties")}
        />
      </div>
      {user ? (
        <RouteLink
          url={`/users/${user.identity.id}`}
          title="Profile"
          selected={path.startsWith("/users")}
        />
      ) : (
        <AuthButton />
      )}
    </nav>
  );
}
