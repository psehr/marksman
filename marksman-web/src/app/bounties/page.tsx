"use client";

import { useAuth } from "@/components/AuthProvider";
import BountyList from "@/components/BountyList";
import SearchPanel, {
  type BountySortingMethod,
} from "@/components/SearchPanel";
import { ExtendedBounty } from "@marksman/contracts";
import Fuse from "fuse.js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export default function BountiesPage() {
  return (
    <Suspense fallback={<p>Loading bounties...</p>}>
      <Bounties />
    </Suspense>
  );
}

function sortByDate(input: ExtendedBounty[], order: "asc" | "desc") {
  switch (order) {
    case "asc":
      return input.sort((a, b) => {
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      });

    case "desc":
      return input.sort((a, b) => {
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }
}

function sortByBpReward(input: ExtendedBounty[], order: "asc" | "desc") {
  switch (order) {
    case "asc":
      return input.sort((a, b) => {
        return a.rewardBp - b.rewardBp;
      });

    case "desc":
      return input.sort((a, b) => {
        return b.rewardBp - a.rewardBp;
      });
  }
}

function Bounties() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const bountyType = status === "completed" ? "completed" : "open";

  type BountyRelationship = "created" | "bookmarked" | null;

  const [queryStatus, setQueryStatus] = useState<
    "loading" | "errored" | "complete"
  >("loading");

  const [bounties, setBounties] = useState<ExtendedBounty[]>([]);

  const { user, loading: authLoading } = useAuth();
  const userId = user?.identity.id;

  const rawRelationship = searchParams.get("relationship");

  const relationship: BountyRelationship =
    rawRelationship === "created" || rawRelationship === "bookmarked"
      ? rawRelationship
      : null;

  const effectiveRelationship = userId ? relationship : null;

  const endpoint =
    effectiveRelationship === "bookmarked"
      ? "/users/me/bookmarked-bounties"
      : "/bounties";

  const searchInput = searchParams.get("search") ?? "";
  const selectedSortingMethod: BountySortingMethod = {
    type: searchParams.get("sort") === "reward" ? "bpReward" : "date",
    order: searchParams.get("order") === "asc" ? "asc" : "desc",
  };

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

  const ownershipFilteredBounties =
    relationship === "created" && user
      ? bounties.filter((b) => b.creatorOsuUserId === user.identity.osuUserId)
      : bounties;

  const fuse = new Fuse(ownershipFilteredBounties, {
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
    : ownershipFilteredBounties;

  useEffect(() => {
    if (authLoading) return;
    let ignore = false;

    async function loadBounties() {
      try {
        setQueryStatus("loading");
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (response.ok) {
          const bounties: ExtendedBounty[] = await response.json();

          if (!ignore) {
            setBounties(
              bounties.filter((bounty) => bounty.status === bountyType),
            );
            setQueryStatus("complete");
          }
        } else {
          throw new Error("Failed to load bounties");
        }
      } catch {
        if (!ignore) {
          setQueryStatus("errored");
        }
      }
    }

    void loadBounties();

    return () => {
      ignore = true;
    };
  }, [bountyType, endpoint, userId, authLoading]);

  const sortedBounties =
    selectedSortingMethod.type === "date"
      ? sortByDate([...searchedBounties], selectedSortingMethod.order)
      : sortByBpReward([...searchedBounties], selectedSortingMethod.order);

  return (
    <div className="flex flex-col w-full h-full items-center gap-12 p-12">
      <div className="flex w-2/5 h-full place-content-center items-center gap-4">
        <Link
          href="/bounties/new"
          className="rounded bg-sky-700 px-4 py-4 h-fit"
        >
          Create a bounty
        </Link>
      </div>
      <div className="flex flex-col w-4/5 h-full items-center gap-4">
        <div className="bg-blue-950 flex w-3/4 p-2 h-full rounded-xl border border-slate-600">
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
            foundBountiesCount={searchedBounties.length}
            relationship={relationship}
            setRelationship={(value) => {
              updateFilters({ relationship: value ? value : null });
            }}
          />
        </div>
        <div className="w-full h-1/2 flex place-content-center items-center">
          {queryStatus === "complete" ? (
            <BountyList
              bounties={sortedBounties}
              hasBounties={bounties.length > 0}
            />
          ) : null}
          {queryStatus === "loading" ? <p>Loading bounties</p> : null}
          {queryStatus === "errored" ? <p>Failed to load bounties</p> : null}
        </div>
      </div>
    </div>
  );
}
