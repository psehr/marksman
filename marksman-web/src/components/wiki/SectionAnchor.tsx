"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { usePathname } from "next/navigation";

/** Next's client navigation does not reliably update the browser's :target. */
export function SectionAnchor({
  id,
  ...props
}: ComponentProps<"section"> & { id: string }) {
  const pathname = usePathname();
  const section = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    function update() {
      let hash = window.location.hash.slice(1);
      try {
        hash = decodeURIComponent(hash);
      } catch {
        /* Ignore malformed escapes. */
      }
      const matches = hash === id;
      setSelected(matches);
      return matches;
    }
    function navigate(event: Event) {
      const url = new URL(
        (event as CustomEvent<string>).detail,
        window.location.href,
      );
      setSelected(url.pathname === pathname && url.hash.slice(1) === id);
    }
    // On a fresh load, the access gate can delay this target until after the
    // browser's initial fragment scroll. Restore it once the section mounts.
    const frame = update()
      ? requestAnimationFrame(() => section.current?.scrollIntoView({ block: "start" }))
      : undefined;
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    window.addEventListener("wiki-section-navigation", navigate);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("wiki-section-navigation", navigate);
    };
  }, [id, pathname]);

  return (
    <section {...props} ref={section} id={id} data-selected={selected ? "true" : undefined} />
  );
}
