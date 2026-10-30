import {
  BOUNTIES_LIST_PAGE_SIZE,
  bountyTiers,
  PROFILE_HISTORY_PAGE_SIZE,
} from "@marksman/contracts";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { bounties, bountyBeatmaps, bountyBookmarks, users } from "./schema";

const creator = alias(users, "creator");
const winner = alias(users, "winner");

import type {
  Bounty,
  BountyEvent,
  BountySearchQuery,
  CreateBountyInput,
  UserIdentity,
} from "@marksman/contracts";
import { db, type Transaction } from "./index";

export function toBounty(row: typeof bounties.$inferSelect): Bounty {
  return {
    id: row.id,
    status: row.status,
    rewardBp: row.rewardBp,
    goal: { ...row.goal, beatmapChecksum: row.goal.beatmapChecksum ?? null },
    creatorOsuUserId: row.creatorOsuUserId,
    completedByOsuUserId: row.completedByOsuUserId,
    completionScoreId: row.completionScoreId,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

export async function listBounties(
  query: BountySearchQuery,
  identity?: UserIdentity,
): Promise<{
  items: Bounty[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const pageNumber =
    Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
  const pageSize = BOUNTIES_LIST_PAGE_SIZE;

  const statusFilter = eq(bounties.status, query.status);

  const goalFilter = query.goals.length
    ? inArray(sql`${bounties.goal}->>'type'`, query.goals)
    : undefined;

  const tierRanges = bountyTiers.flatMap((tier, index) => {
    if (!query.tiers.includes(tier.name)) return [];

    const upperBound = bountyTiers[index - 1];

    return [
      and(
        gte(bounties.rewardBp, tier.minimumBp),
        upperBound ? lt(bounties.rewardBp, upperBound.minimumBp) : undefined,
      ),
    ];
  });
  const tierFilter = tierRanges.length ? or(...tierRanges) : undefined;

  const modRule = sql<string>`${bounties.goal}->'modRequirement'->>'rule'`;
  const requiredMods = sql`${bounties.goal}->'modRequirement'->'mods'`;

  const modsFilter = !query.mods.length
    ? undefined
    : query.mods.includes("NM")
      ? and(eq(modRule, "exact"), sql`${requiredMods} = '[]'::jsonb`)
      : and(
          inArray(modRule, ["exact", "includes"]),
          sql`${requiredMods} @> ${JSON.stringify(query.mods)}::jsonb`,
        );

  const escapedSearch = query.search.replace(/[\\%_]/g, "\\$&");
  const searchPattern = `%${escapedSearch}%`;
  const searchFilter =
    query.search.length > 0
      ? or(
          ilike(
            sql<string>`${bountyBeatmaps.metadata}->'song'->>'title'`,
            searchPattern,
          ),
          ilike(
            sql<string>`${bountyBeatmaps.metadata}->'song'->>'artist'`,
            searchPattern,
          ),
          ilike(
            sql<string>`${bountyBeatmaps.metadata}->'version'->>'name'`,
            searchPattern,
          ),
          ilike(
            sql<string>`${bountyBeatmaps.metadata}->'creator'->>'username'`,
            searchPattern,
          ),
          ilike(creator.username, searchPattern),
        )
      : undefined;

  let relationshipFilter;
  if (identity) {
    switch (query.relationship) {
      case "all":
        break;
      case "bookmarked":
        relationshipFilter = exists(
          db
            .select()
            .from(bountyBookmarks)
            .where(
              and(
                eq(bountyBookmarks.bountyId, bounties.id),
                eq(bountyBookmarks.userId, identity.id),
              ),
            ),
        );
        break;
      case "created":
        relationshipFilter = eq(bounties.creatorOsuUserId, identity.osuUserId);
        break;
    }
  }

  const filters = and(
    statusFilter,
    searchFilter,
    relationshipFilter,
    goalFilter,
    tierFilter,
    modsFilter,
  );

  let sortMethod;
  switch (query.sort) {
    case "date":
      sortMethod =
        query.order === "asc"
          ? asc(bounties.createdAt)
          : desc(bounties.createdAt);
      break;

    case "reward":
      sortMethod =
        query.order === "asc"
          ? asc(bounties.rewardBp)
          : desc(bounties.rewardBp);
      break;
  }

  const rows = await db
    .select({ ...getTableColumns(bounties) })
    .from(bounties)
    .leftJoin(
      bountyBeatmaps,
      eq(
        bountyBeatmaps.beatmapId,
        sql<number>`(${bounties.goal}->>'beatmapId')::integer`,
      ),
    )
    .leftJoin(creator, eq(bounties.creatorOsuUserId, creator.osuUserId))
    .where(filters)
    .orderBy(sortMethod, bounties.id)
    .limit(pageSize)
    .offset((pageNumber - 1) * pageSize);

  const [result] = await db
    .select({ total: count() })
    .from(bounties)
    .leftJoin(
      bountyBeatmaps,
      eq(
        bountyBeatmaps.beatmapId,
        sql<number>`(${bounties.goal}->>'beatmapId')::integer`,
      ),
    )
    .leftJoin(creator, eq(bounties.creatorOsuUserId, creator.osuUserId))
    .where(filters);

  return {
    items: rows.map(toBounty),
    total: result.total,
    page: pageNumber,
    pageSize,
  };
}

export async function findBountyById(
  connection: Transaction | typeof db,
  id: string,
): Promise<Bounty | undefined> {
  const [row] = await connection
    .select()
    .from(bounties)
    .where(eq(bounties.id, id));

  return row ? toBounty(row) : undefined;
}

export async function findBountyByIdForUpdate(
  connection: Transaction,
  id: string,
): Promise<Bounty | undefined> {
  const [row] = await connection
    .select()
    .from(bounties)
    .where(eq(bounties.id, id))
    .for("update");

  return row ? toBounty(row) : undefined;
}

export async function createBounty(
  tx: Transaction,
  input: CreateBountyInput,
  creatorOsuUserId: number,
): Promise<Bounty> {
  const [row] = await tx
    .insert(bounties)
    .values({
      status: "open",
      rewardBp: input.rewardBp,
      goal: input.goal,
      creatorOsuUserId,
    })
    .returning();

  return toBounty(row);
}

export async function markOpenBountyCancelled(
  tx: Transaction,
  bountyId: string,
  requesterOsuUserId: number,
): Promise<Bounty | undefined> {
  const [row] = await tx
    .update(bounties)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(bounties.id, bountyId),
        eq(bounties.creatorOsuUserId, requesterOsuUserId),
        eq(bounties.status, "open"),
      ),
    )
    .returning();
  return row ? toBounty(row) : undefined;
}

export async function markOpenBountyCompleted(
  tx: Transaction,
  bountyId: string,
  osuUserId: number,
  scoreId: number,
): Promise<Bounty | undefined> {
  const [row] = await tx
    .update(bounties)
    .set({
      status: "completed",
      completedByOsuUserId: osuUserId,
      completionScoreId: scoreId,
      completedAt: new Date(),
    })
    .where(and(eq(bounties.id, bountyId), eq(bounties.status, "open")))
    .returning();
  return row ? toBounty(row) : undefined;
}

export async function getBountyEventsOfUser(
  identity: UserIdentity,
  page: number,
): Promise<BountyEvent[]> {
  const pageNumber = Number.isInteger(page) && page > 0 ? page : 1;
  const pageSize = PROFILE_HISTORY_PAGE_SIZE;

  const rows = await db
    .select({
      createdAt: bounties.createdAt,
      completedAt: bounties.completedAt,
      cancelledAt: bounties.cancelledAt,
      bountyId: bounties.id,
      creatorOsuId: bounties.creatorOsuUserId,
      winnerOsuId: bounties.completedByOsuUserId,
      status: bounties.status,
      creator: {
        id: creator.id,
        osuUserId: creator.osuUserId,
        username: creator.username,
      },
      winner: {
        id: winner.id,
        osuUserId: winner.osuUserId,
        username: winner.username,
      },
    })
    .from(bounties)
    .leftJoin(creator, eq(bounties.creatorOsuUserId, creator.osuUserId))
    .leftJoin(winner, eq(bounties.completedByOsuUserId, winner.osuUserId))
    .where(
      or(
        eq(bounties.creatorOsuUserId, identity.osuUserId),
        eq(bounties.completedByOsuUserId, identity.osuUserId),
      ),
    );

  const events = rows
    .flatMap((row) => {
      const rowEvents: BountyEvent[] = [];

      const isCreator = row.creatorOsuId === identity.osuUserId;
      const isWinner = row.winnerOsuId === identity.osuUserId;

      // only show creation events if user is creator
      if (isCreator && row.status !== "draft") {
        rowEvents.push({
          type: "created",
          timestamp: row.createdAt.toISOString(),
          bountyId: row.bountyId,
          creator: row.creator,
          winner: null,
        });
      }

      // only show cancellations events if user is creator
      if (isCreator && row.cancelledAt) {
        rowEvents.push({
          type: "cancelled",
          timestamp: row.cancelledAt.toISOString(),
          bountyId: row.bountyId,
          creator: row.creator,
          winner: null,
        });
      }

      // show completion events for both creator/winner users
      if ((isCreator || isWinner) && row.completedAt) {
        rowEvents.push({
          type: "completed",
          timestamp: row.completedAt.toISOString(),
          bountyId: row.bountyId,
          creator: row.creator,
          winner: row.winner,
        });
      }

      return rowEvents;
    })
    .sort(
      (a, b) =>
        Date.parse(b.timestamp) - Date.parse(a.timestamp) ||
        a.bountyId.localeCompare(b.bountyId) ||
        a.type.localeCompare(b.type),
    )
    .slice((pageNumber - 1) * pageSize, (pageNumber - 1) * pageSize + pageSize);

  return events;
}
