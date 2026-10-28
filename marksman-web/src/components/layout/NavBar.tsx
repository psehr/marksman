"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../auth/AuthProvider";
import { AuthButton } from "../auth/AuthButton";
import MarksmanLogo from "../ui/MarksmanLogo";

function RouteLink({
  url,
  title,
  selected,
  className,
}: {
  url: string;
  title: string;
  selected: boolean;
  className?: string;
}) {
  return (
    <Link
      href={url}
      className={`cursor-pointer ${className} ${selected ? "text-accent" : "text-foreground-muted"}`}
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
    <nav className="border-border bg-surface flex min-h-16 w-full flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <Link href="/" aria-current={path === "/" ? "page" : undefined}>
        <MarksmanLogo />
      </Link>

      <div className="flex items-center gap-3 text-center sm:gap-8">
        <RouteLink
          url="/bounties"
          title="Bounties"
          selected={path.startsWith("/bounties")}
        />
        <span className="text-border">•</span>
        {user ? (
          <RouteLink
            url={`/users/${user.identity.id}`}
            title="Profile"
            selected={path.startsWith("/users/" + user.identity.id)}
          />
        ) : (
          <AuthButton />
        )}
      </div>
    </nav>
  );
}
