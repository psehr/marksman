"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import BountyList from "@/components/bounties/BountyList";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import BountyFilters, {
  type BountySortingMethod,
} from "@/components/bounties/BountyFilters";
import { useBounties } from "@/hooks/useBounties";
import {
  tierOptions,
  goalOptions,
  modOptions,
  parseSelection,
  parseModSelection,
  toggleSelection,
  type BountyModFilter,
} from "@/lib/bounty-filters";
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

  const selectedFilters = {
    tiers: parseSelection(searchParams.get("tiers"), tierOptions),
    goals: parseSelection(searchParams.get("goals"), goalOptions),
    mods: parseModSelection(searchParams.get("mods")),
  };

  const searchInput = searchParams.get("search") ?? "";

  const selectedSortingMethod: BountySortingMethod = {
    type: searchParams.get("sort") === "reward" ? "bpReward" : "date",
    order: searchParams.get("order") === "asc" ? "asc" : "desc",
  };

  const rawPage = Number(searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const { bounties, queryStatus, total, pageSize } = useBounties({
    status: bountyType,
    relationship: relationship ?? "all",
    search: searchInput.trim(),
    sort: selectedSortingMethod.type === "bpReward" ? "reward" : "date",
    order: selectedSortingMethod.order,
    tiers: [...selectedFilters.tiers],
    goals: [...selectedFilters.goals],
    mods: [...selectedFilters.mods],
    page,
  });
  const hasFilters = Boolean(
    searchInput.trim() ||
    selectedFilters.tiers.size ||
    selectedFilters.goals.size ||
    selectedFilters.mods.size ||
    (user && relationship),
  );
  const totalPages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  function updateFilters(
    values: Record<string, string | null>,
    replace = false,
  ) {
    // Read the current URL so consecutive changes preserve each other.
    const url = new URL(window.location.href);
    if (!("page" in values)) url.searchParams.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }

  function toggleMod(mod: BountyModFilter) {
    const current = parseModSelection(
      new URL(window.location.href).searchParams.get("mods"),
    );
    if (mod === "NM") {
      updateFilters({ mods: current.has("NM") ? null : "NM" });
    } else {
      current.delete("NM");
      updateFilters({ mods: toggleSelection(current, mod, modOptions) });
    }
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
        <div className="flex flex-col w-full gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ButtonLink
              href="/bounties/creation-tool"
              variant="accent"
              className="font-bold"
            >
              Create a bounty
            </ButtonLink>
            <ButtonLink href="/bounties/about">About bounties</ButtonLink>
          </div>
          <BountyFilters
            selectedFilters={selectedFilters}
            onToggleTier={(tier) => {
              const current = parseSelection(
                new URL(window.location.href).searchParams.get("tiers"),
                tierOptions,
              );
              updateFilters({
                tiers: toggleSelection(current, tier, tierOptions),
              });
            }}
            onToggleGoal={(goal) => {
              const current = parseSelection(
                new URL(window.location.href).searchParams.get("goals"),
                goalOptions,
              );
              updateFilters({
                goals: toggleSelection(current, goal, goalOptions),
              });
            }}
            onToggleMod={toggleMod}
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
            foundBountiesCount={total}
            relationship={relationship}
            setRelationship={(value) => {
              updateFilters({ relationship: value ? value : null });
            }}
          />
        </div>
        <div className="w-full max-w-6xl h-1/2 flex place-content-center items-center">
          {queryStatus === "complete" ? (
            <BountyList
              bounties={bounties}
              hasBounties={hasFilters || total > 0 || page > 1}
            />
          ) : null}
          {queryStatus === "loading" ? <p>Loading bounties</p> : null}
          {queryStatus === "errored" ? <p>Failed to load bounties</p> : null}
        </div>
        {queryStatus === "complete" && (totalPages > 1 || page > 1) ? (
          <nav
            aria-label="Bounty pagination"
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Button
              disabled={page <= 1}
              onClick={() =>
                updateFilters({ page: page === 2 ? null : String(page - 1) })
              }
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              disabled={page >= totalPages}
              onClick={() => updateFilters({ page: String(page + 1) })}
            >
              Next
            </Button>
            {page > totalPages ? (
              <Button onClick={() => updateFilters({ page: null })}>
                First page
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
