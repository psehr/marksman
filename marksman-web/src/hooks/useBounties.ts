import { useAuth } from "@/components/auth/AuthProvider";
import { getAllBounties, getBookmarkedBounties } from "@/lib/api/bounties";
import type { ExtendedBounty } from "@marksman/contracts";
import Fuse from "fuse.js";
import { useEffect, useState } from "react";

type BountiesFilter = {
  bookmarked: boolean;
  ownership: {
    filter: boolean;
    ownerOsuId?: number;
  };
  status: {
    filter: boolean;
    selectedStatus?: Extract<ExtendedBounty["status"], "open" | "completed">;
  };
};

type BountySorting = {
  type: "date" | "bpReward";
  order: "asc" | "desc";
};

export function useBounties(
  filter: BountiesFilter,
  searchInput: string,
  sortMethod: BountySorting,
) {
  const [bounties, setBounties] = useState<ExtendedBounty[]>([]);
  const [queryStatus, setQueryStatus] = useState<
    "loading" | "errored" | "complete"
  >("loading");

  const { user, loading: authLoading } = useAuth();
  const userId = user?.identity.id;
  const bookmarked = Boolean(userId) && filter.bookmarked;

  useEffect(() => {
    if (authLoading) return;
    let ignore = false;

    async function load() {
      try {
        const bounties: ExtendedBounty[] = bookmarked
          ? await getBookmarkedBounties()
          : await getAllBounties();

        if (!ignore) {
          setBounties(bounties);
          setQueryStatus("complete");
        }
      } catch {
        if (!ignore) {
          setQueryStatus("errored");
        }
      }
    }
    setQueryStatus("loading");

    void load();

    return () => {
      ignore = true;
    };
  }, [userId, authLoading, bookmarked]);

  const { filteredBounties, hasBounties } = filterBounties(bounties, {
    ...filter,
    ownership: {
      ...filter.ownership,
      filter: Boolean(userId) && filter.ownership.filter,
    },
  });
  const searchedBounties = searchBounties(filteredBounties, searchInput);
  const sortedBounties = sortBounties(searchedBounties, sortMethod);

  return { bounties: sortedBounties, queryStatus, hasBounties };
}

function filterBounties(
  bounties: ExtendedBounty[],
  filter: BountiesFilter,
): { filteredBounties: ExtendedBounty[]; hasBounties: boolean } {
  const statusFiltered = filter.status.filter
    ? bounties.filter(
        (bounty) => bounty.status === filter.status.selectedStatus,
      )
    : bounties;

  const hasBounties = statusFiltered.length > 0;

  const ownershipFiltered = filter.ownership.filter
    ? statusFiltered.filter(
        (bounty) => bounty.creatorOsuUserId === filter.ownership.ownerOsuId,
      )
    : statusFiltered;

  return { filteredBounties: ownershipFiltered, hasBounties };
}

function searchBounties(bounties: ExtendedBounty[], searchInput: string) {
  const fuse = new Fuse(bounties, {
    keys: [
      "beatmap.song.title",
      "beatmap.song.artist",
      "beatmap.version.name",
      "owner.username",
    ],
    threshold: 0.3,
    ignoreLocation: true,
  });

  const searchedBounties = searchInput.trim()
    ? fuse.search(searchInput.trim()).map((result) => result.item)
    : bounties;

  return searchedBounties;
}

function sortBounties(bounties: ExtendedBounty[], sortMethod: BountySorting) {
  let sortedBounties: ExtendedBounty[] = [...bounties];

  switch (sortMethod.type) {
    case "date":
      if (sortMethod.order === "asc") {
        sortedBounties = bounties.toSorted(
          (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
        );
      } else if (sortMethod.order === "desc") {
        sortedBounties = bounties.toSorted(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
      }
      break;

    case "bpReward":
      if (sortMethod.order === "asc") {
        sortedBounties = bounties.toSorted((a, b) => {
          return a.rewardBp - b.rewardBp;
        });
      } else if (sortMethod.order === "desc") {
        sortedBounties = bounties.toSorted((a, b) => {
          return b.rewardBp - a.rewardBp;
        });
      }
      break;
  }

  return sortedBounties;
}
