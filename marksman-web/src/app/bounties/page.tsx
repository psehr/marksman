"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import BountyList from "@/components/bounties/BountyList";
import ButtonLink from "@/components/ui/ButtonLink";
import SearchPanel, {
  type BountySortingMethod,
} from "@/components/bounties/BountyFilters";
import { useBounties } from "@/hooks/useBounties";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function BountiesPage() {
  return (
    <Suspense fallback={<p>Loading bounties...</p>}>
      <Bounties />
    </Suspense>
  );
}

function Bounties() {
  const searchParams = useSearchParams();

  type BountyRelationship = "created" | "bookmarked" | null;

  const { user } = useAuth();

  const status = searchParams.get("status");
  const bountyType = status === "completed" ? "completed" : "open";

  const rawRelationship = searchParams.get("relationship");
  const relationship: BountyRelationship =
    rawRelationship === "created" || rawRelationship === "bookmarked"
      ? rawRelationship
      : null;

  const searchInput = searchParams.get("search") ?? "";

  const selectedSortingMethod: BountySortingMethod = {
    type: searchParams.get("sort") === "reward" ? "bpReward" : "date",
    order: searchParams.get("order") === "asc" ? "asc" : "desc",
  };

  const {
    bounties: sortedBounties,
    queryStatus,
    hasBounties,
  } = useBounties(
    {
      bookmarked: relationship === "bookmarked",
      ownership: {
        filter: relationship === "created",
        ownerOsuId: user?.identity.osuUserId,
      },
      status: {
        filter: true,
        selectedStatus: bountyType,
      },
    },
    searchInput,
    selectedSortingMethod,
  );

  function updateFilters(
    values: Record<string, string | null>,
    replace = false,
  ) {
    // Read the current URL so consecutive changes preserve each other.
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }

  function setSelectedSortingMethod(method: BountySortingMethod) {
    updateFilters({
      sort: method.type === "bpReward" ? "reward" : null,
      order: method.order === "asc" ? "asc" : null,
    });
  }

  return (
    <div className="flex flex-col w-full h-full items-center gap-12 py-12 px-4">
      <div className="flex flex-col w-full max-w-6xl h-full items-center gap-4">
        <div className="bg-surface flex w-full p-2 h-full rounded-xl border border-border">
          <SearchPanel
            searchInput={searchInput}
            setSearchInput={(value) =>
              updateFilters({ search: value || null }, true)
            }
            bountyType={bountyType}
            setBountyType={(value) =>
              updateFilters({
                status: value === "completed" ? "completed" : null,
              })
            }
            setSelectedSortingMethod={setSelectedSortingMethod}
            selectedSortingMethod={selectedSortingMethod}
            foundBountiesCount={sortedBounties.length}
            relationship={relationship}
            setRelationship={(value) => {
              updateFilters({ relationship: value ? value : null });
            }}
          />
        </div>
        <div className="w-full max-w-6xl h-1/2 flex place-content-center items-center">
          {queryStatus === "complete" ? (
            <BountyList bounties={sortedBounties} hasBounties={hasBounties} />
          ) : null}
          {queryStatus === "loading" ? <p>Loading bounties</p> : null}
          {queryStatus === "errored" ? <p>Failed to load bounties</p> : null}
        </div>
      </div>
    </div>
  );
}
