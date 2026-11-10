import { useSearchParams } from "next/navigation";

export type BountyView = "overview" | "engagement" | "activity" | "funding" | "comments";

export function parseBountyView(value: string | null): BountyView {
  return value === "engagement" || value === "activity" || value === "funding" || value === "comments"
    ? value
    : "overview";
}

export function getBountyViewUrl(currentUrl: string, view: BountyView): URL {
  const url = new URL(currentUrl);
  if (view === "overview") url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  return url;
}

export function useBountyView() {
  const searchParams = useSearchParams();
  const view = parseBountyView(searchParams.get("view"));

  function setView(nextView: BountyView) {
    const url = getBountyViewUrl(window.location.href, nextView);
    if (url.href !== window.location.href) {
      window.history.pushState(null, "", url);
    }
  }

  return { view, setView };
}
