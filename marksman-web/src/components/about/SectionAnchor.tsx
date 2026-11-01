"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { usePathname } from "next/navigation";

/** Next's client navigation does not reliably update the browser's :target. */
export function SectionAnchor({ id, ...props }: ComponentProps<"section"> & { id: string }) {
  const pathname = usePathname();
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    function update() {
      let hash = window.location.hash.slice(1);
      try { hash = decodeURIComponent(hash); } catch { /* Ignore malformed escapes. */ }
      setSelected(hash === id);
    }
    function navigate(event: Event) {
      const url = new URL((event as CustomEvent<string>).detail, window.location.href);
      setSelected(url.pathname === pathname && url.hash.slice(1) === id);
    }
    update();
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener("about-section-navigation", navigate);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("about-section-navigation", navigate);
    };
  }, [id, pathname]);

  return <section {...props} id={id} data-selected={selected ? "true" : undefined} />;
}
