import { bountySearchQuerySchema, getBountyTier, type ExtendedBounty } from "@marksman/contracts";

// Mock server behavior for browser interactions; real SQL is covered by API tests.
export function listResponse(rows: ExtendedBounty[], url: string, viewerOsuId?: number, bookmarkedIds: string[] = []) {
  const query = bountySearchQuerySchema.parse(Object.fromEntries(new URL(url).searchParams));
  const filtered = rows.filter(row => {
    if (row.status !== query.status) return false;
    if (query.relationship === "created" && row.creatorOsuUserId !== viewerOsuId) return false;
    if (query.relationship === "bookmarked" && !bookmarkedIds.includes(row.id)) return false;
    if (query.tiers.length && !query.tiers.includes(getBountyTier(row.rewardBp))) return false;
    if (query.goals.length && !query.goals.includes(row.goal.type)) return false;
    const requirement = row.goal.modRequirement;
    if (query.mods.includes("NM")) {
      if (requirement.rule !== "exact" || requirement.mods.length) return false;
    } else if (query.mods.length) {
      if (requirement.rule !== "exact" && requirement.rule !== "includes") return false;
      if (!query.mods.every(mod => mod !== "NM" && requirement.mods.includes(mod))) return false;
    }
    return !query.search || [row.owner?.username, row.beatmap?.song?.title, row.beatmap?.song?.artist, row.beatmap?.version.name, row.beatmap?.creator?.username].some(value => value?.toLowerCase().includes(query.search.toLowerCase()));
  });
  filtered.sort((a, b) => {
    const difference = query.sort === "reward" ? a.rewardBp - b.rewardBp : Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return difference * (query.order === "asc" ? 1 : -1) || a.id.localeCompare(b.id);
  });
  return { items: filtered.slice((query.page - 1) * 20, query.page * 20), total: filtered.length, page: query.page, pageSize: 20 };
}
export const listUrl = /\/bounties(?:\?.*)?$/;
