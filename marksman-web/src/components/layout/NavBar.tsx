"use client";

import { useEffect, useRef, useState } from "react";
import Button from "../ui/Button";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../auth/AuthProvider";
import { AuthButton } from "../auth/AuthButton";
import MarksmanLogo from "../ui/MarksmanLogo";
import { aes_font } from "@/lib/fonts";

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
            url="/about"
            title="About"
            selected={path.startsWith("/about")}
            onClick={closeMenu}
          />
        </div>
        <div className="flex md:w-1/3 md:justify-end">
          {user ? (
            <RouteLink
              url={`/users/${user.identity.id}`}
              title="Profile"
              onClick={closeMenu}
              selected={path.startsWith("/users/" + user.identity.id)}
            />
          ) : (
            <AuthButton />
          )}
        </div>
      </div>
    </nav>
  );
}
