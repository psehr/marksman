import { getUserHunts } from "@/lib/api/users";
import type { UserHuntedBounties } from "@marksman/contracts";
import { useEffect, useState } from "react";

type HuntsState = {
  userId: string;
  hunts: UserHuntedBounties;
  status: "loading" | "errored" | "complete";
};

export function useUserHunts(id: string) {
  const [state, setState] = useState<HuntsState>({
    userId: id,
    hunts: [],
    status: "loading",
  });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    setState({ userId: id, hunts: [], status: "loading" });

    async function load() {
      try {
        const hunts = await getUserHunts(id, controller.signal);
        if (!ignore) setState({ userId: id, hunts, status: "complete" });
      } catch {
        if (!ignore) setState({ userId: id, hunts: [], status: "errored" });
      }
    }

    void load();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [id, refresh]);

  return {
    hunts: state.userId === id ? state.hunts : [],
    huntsQueryStatus: state.userId === id ? state.status : ("loading" as const),
    refreshHunts: () => setRefresh(previous => previous + 1),
  };
}
