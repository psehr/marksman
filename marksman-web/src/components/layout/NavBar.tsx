"use client";

import { useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../auth/AuthProvider";
import { AuthButton } from "../auth/AuthButton";
import MarksmanLogo from "../ui/MarksmanLogo";
import { aes_font } from "@/lib/fonts";
import BPIcon from "../economy/BPIcon";

function RouteLink({
  url,
  title,
  selected,
  className,
  onClick,
}: {
  url: string;
  title: string;
  selected: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={url}
      onClick={onClick}
      className={`cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4 ${className ?? ""} ${selected ? "text-accent" : "text-foreground-muted"} ${aes_font.className} font-bold  text-xl`}
      aria-current={selected ? "page" : undefined}
    >
      {title}
    </Link>
  );
}

export default function NavBar() {
  const path = usePathname();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          closeMenu();
          menuButton.current?.focus();
        }
      }}
      className="border-border bg-surface flex min-h-16 w-full flex-wrap items-center border-b px-4 py-3"
    >
      <div className="flex min-w-0 flex-1 place-content-start md:w-1/3 md:flex-none">
        <Link
          href="/"
          onClick={closeMenu}
          aria-current={path === "/" ? "page" : undefined}
        >
          <MarksmanLogo />
        </Link>
      </div>
      <Button
        ref={menuButton}
        variant="outline"
        className="md:hidden"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg
          aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path
            d={menuOpen ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </Button>
      <div
        id="mobile-navigation"
        className={`${menuOpen ? "flex" : "hidden"} w-full flex-col gap-4 pt-4 md:contents`}
      >
        <div className="flex flex-col gap-4 md:w-1/3 md:flex-row md:justify-center">
          <RouteLink
            url="/bounties"
            title="Bounties"
            selected={path.startsWith("/bounties")}
            onClick={closeMenu}
          />
          <span className="text-border hidden md:inline">•</span>
          <RouteLink
            url="/rankings"
            title="Rankings"
            selected={path.startsWith("/rankings")}
            onClick={closeMenu}
          />
          <span className="text-border hidden md:inline">•</span>
          <RouteLink
            url="/wiki"
            title="Wiki"
            selected={path.startsWith("/wiki")}
            onClick={closeMenu}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:w-1/3 md:justify-end">
          {user ? (
            <Link
              href={`/users/${user.identity.id}`}
              aria-label="Profile"
              aria-current={path.startsWith(`/users/${user.identity.id}`) ? "page" : undefined}
              onClick={closeMenu}
              className={`flex min-w-36 max-w-full items-center justify-between gap-3 rounded border border-border bg-card px-3 py-1 text-right hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ${aes_font.className} font-bold`}
            >
              <Image
                src={`https://a.ppy.sh/${user.identity.osuUserId}`}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full object-cover"
              />
              <div className="flex min-w-0 flex-col items-end gap-0.5">
                <span className="max-w-40 truncate text-sm text-accent" title={user.identity.username}>
                  {user.identity.username}
                </span>
                <output
                  aria-label="Your BP balance"
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-foreground-muted tabular-nums"
                >
                  {user.stats.bpBalance.toLocaleString()}
                  <BPIcon size="sm" />
                </output>
              </div>
            </Link>
          ) : (
            <AuthButton />
          )}
        </div>
      </div>
    </nav>
  );
}
