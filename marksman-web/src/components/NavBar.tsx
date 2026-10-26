"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { AuthButton } from "./AuthButton";
import ButtonLink from "./buttons/ButtonLink";

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
    <nav className="flex min-h-16 w-full flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-8">
      <div className="flex gap-3 sm:gap-8 items-center">
        <RouteLink
          url="/"
          title="Marksman"
          selected
          className="font-bold text-xl"
        />
      </div>

      <div className="flex gap-3 sm:gap-8 items-center text-center">
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
            selected={path.startsWith("/users")}
          />
        ) : (
          <AuthButton />
        )}
        <span className="text-border">•</span>
        <ButtonLink href="/bounties/new" variant="confirm">
          Create a bounty
        </ButtonLink>
      </div>
    </nav>
  );
}
