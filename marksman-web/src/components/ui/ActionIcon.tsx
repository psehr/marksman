import type { ReactNode } from "react";

type Action = "hunt" | "stop" | "bookmark" | "bookmarked" | "share" | "osu" | "download" | "cancel" | "refresh";

/** Decorative, current-color icons for labelled action controls. */
export default function ActionIcon({ action }: { action: Action }) {
  let artwork: ReactNode;
  switch (action) {
    case "hunt":
      artwork = <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>;
      break;
    case "stop":
      artwork = <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none" />;
      break;
    case "bookmark":
    case "bookmarked":
      artwork = <path d="M6 3h12v18l-6-4-6 4V3Z" fill={action === "bookmarked" ? "currentColor" : "none"} />;
      break;
    case "share":
      artwork = <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m9 10 6-3m-6 7 6 3" /></>;
      break;
    case "osu":
      artwork = <><circle cx="12" cy="12" r="10" /><text x="12" y="15" textAnchor="middle" fill="currentColor" stroke="none" fontSize="9" fontFamily="Arial, sans-serif" fontWeight="bold">osu!</text></>;
      break;
    case "download":
      artwork = <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />;
      break;
    case "cancel":
      artwork = <path d="m5 5 14 14M19 5 5 19" />;
      break;
    case "refresh":
      artwork = <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 6a8 8 0 0 1 13 2l1 4M4 12l1 4a8 8 0 0 0 13 2" /></>;
      break;
  }
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline-block shrink-0">
      {artwork}
    </svg>
  );
}
