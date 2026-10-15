import { and, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { bounties, users } from "./schema";

const creator = alias(users, "creator");
const winner = alias(users, "winner");

import type {
  Bounty,
  BountyEvent,
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

export async function listBounties(): Promise<Bounty[]> {
  const rows = await db
    .select()
    .from(bounties)
    .orderBy(desc(bounties.createdAt));

  return rows.map(toBounty);
}

export async function findBountyById(
  id: string,
  connection: typeof db | Transaction = db,
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
  const pageSize = 20;

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
