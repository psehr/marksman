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
      className={`cursor-pointer ${selected ? "opacity-100" : "opacity-30"}`}
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
    <nav className="flex w-full h-16 place-content-between items-center bg-blue-950 gap-8 px-12">
      <div className="flex gap-8 items-center">
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
