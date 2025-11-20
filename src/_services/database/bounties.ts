"use server";

import {
  Bounty,
  BountyTier,
  BountyType,
  ClaimAttempt,
  ClaimResults,
} from "@/src/_models/bounty";
import { Mod, OsuScore } from "@/src/_models/score";
import { fetchScoreDetails } from "../osu_api/score";
import { parseOsuScoreFromOsuApiScore } from "../utils/parsers/score";
import { scores_details_response } from "osu-api-extended/dist/types/v2/scores_details";
import {
  claimValidation,
  hasRequiredMods,
  isAClear,
  isAnFC,
} from "@/src/_utils/claim_validation";
import { OsuUser } from "@/src/_models/user";

const API_URL = "http://localhost:3000/api";

const arrayToSearchParams = (arr: string[] | number[]) => {
  return arr.join(",");
};

/**
 * Fetches all existing bounties from the local API, with selection and ordering filters.
 * @param sortMethod The selected sorting type out of "recent" (date) and "reward".
 * @param typeFilter The selected {@link BountyType}.
 * @param modsFilter The selected {@link Mod | mods} array.
 * @param bountyTierFilter The selected {@link BountyTier}.
 * @returns An array of the corresponding {@link Bounty | bounties}.
 */
export async function fetchAllBounties({
  sortMethod,
  typeFilter,
  modsFilter,
  bountyTierFilter,
}: {
  sortMethod: "recent" | "reward";
  typeFilter?: BountyType;
  modsFilter?: Mod[];
  bountyTierFilter?: BountyTier;
}): Promise<Bounty[]> {
  return new Promise(async (resolve, reject) => {
    let baseRoute = API_URL + "/bounties";

    !typeFilter ? (typeFilter = "Any") : null;
    !bountyTierFilter ? (bountyTierFilter = "Any") : null;

    let formattedSortMethod = "sort=" + sortMethod;
    let formattedTypeFilter = "";
    let formattedModsFilter = "";
    let formattedBountyTierFilter = "&tier=" + bountyTierFilter;
    if (typeFilter == "Any") {
      formattedTypeFilter = "&types=FC,Clear";
    } else {
      formattedTypeFilter = "&types=" + typeFilter;
    }
    if (modsFilter) {
      formattedModsFilter =
        "&mods=" + arrayToSearchParams(modsFilter as string[]);
    } else {
      formattedModsFilter = "&mods=nm";
    }

    let searchParams =
      "?" +
      formattedSortMethod +
      formattedTypeFilter +
      formattedModsFilter +
      formattedBountyTierFilter;

    const allBountiesRaw = await fetch(baseRoute + searchParams, {
      method: "GET",
    });
    const allBounties = (await allBountiesRaw.json()) as Array<Bounty>;
    resolve(allBounties);
  });
}

/**
 * Compares a score_id against a bounty_id to obtain a potential claim result.
 *
 *
 * @param type - The selected bounty claim type out of "manual" and "auto".
 * @param score_id - The score_id that will be checked in the attempt.
 * @param user_id - The user_id of the user trying to claim the bounty.
 * @param bounty_id - The bounty_id that is attempted to be claimed.
 * @returns A {@link ClaimResults} object containing the results of the attempt.
 *
 */
export async function bountyClaimAttempt(
  type: "manual" | "auto",
  score_id: number,
  user_id: number,
  bounty_id: string
): Promise<ClaimResults> {
  return new Promise(async (resolve, reject) => {
    let baseRoute = API_URL + "/bounties/" + bounty_id;

    const fetchedBounty = await fetch(baseRoute, {
      method: "GET",
    });
    const bounty_data = (await fetchedBounty.json()) as Bounty;

    let fetchedScore;
    let score_data: OsuScore;
    if (score_id) {
      fetchedScore = await fetchScoreDetails(score_id);
      score_data = parseOsuScoreFromOsuApiScore(
        fetchedScore as scores_details_response
      );
      if (bounty_data && score_data) {
        const claimResults = claimValidation(bounty_data, score_data, user_id);
        resolve(claimResults);
      }
    }
  });
}
