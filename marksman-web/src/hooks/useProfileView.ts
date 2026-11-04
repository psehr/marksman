import { useSearchParams } from "next/navigation";

export type ProfileView = "activity" | "hunting" | "created";

export function parseProfileView(value: string | null): ProfileView {
  return value === "activity" || value === "created" ? value : "hunting";
}

export function getProfileViewUrl(currentUrl: string, view: ProfileView): URL {
  const url = new URL(currentUrl);
  if (view === "hunting") url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  return url;
}

export function useProfileView() {
  const searchParams = useSearchParams();
  const view = parseProfileView(searchParams.get("view"));

  function setView(nextView: ProfileView) {
    const url = getProfileViewUrl(window.location.href, nextView);
    if (url.href !== window.location.href) {
      window.history.pushState(null, "", url);
    }
  }

  return { view, setView };
}
