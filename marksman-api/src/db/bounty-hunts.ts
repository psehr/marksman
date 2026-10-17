import { and, eq, sql } from "drizzle-orm";
import { db, Transaction } from ".";
import { bounties, bountyHunts, users } from "./schema";
import { Hunt } from "@marksman/contracts";

export function toHunt(row: typeof bountyHunts.$inferSelect): Hunt {
  return {
    id: row.id,
    status: row.status,
    userId: row.userId,
    bountyId: row.bountyId,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

export async function countUserOngoingHunts(
  connection: Transaction,
  userId: string,
): Promise<number> {
  const rows = await connection
    .select({ id: bountyHunts.id })
    .from(bountyHunts)
    // only hunts:
    // - owned by the user
    // - currently ongoing
    .where(
      and(eq(bountyHunts.userId, userId), eq(bountyHunts.status, "ongoing")),
    );

  return rows.length;
}

export async function isUserHuntingBounty(
  connection: Transaction,
  userId: string,
  bountyId: string,
): Promise<boolean> {
  const [row] = await connection
    .select({ id: bountyHunts.id })
    .from(bountyHunts)
    // only hunts:
    // - owned by the user
    // - of this bounty
    // - currently ongoing
    .where(
      and(
        eq(bountyHunts.userId, userId),
        eq(bountyHunts.bountyId, bountyId),
        eq(bountyHunts.status, "ongoing"),
      ),
    )
    .limit(1);

  return !!row;
}

export async function insertHunt(
  connection: Transaction,
  userId: string,
  bountyId: string,
  startedAt: Date,
): Promise<Hunt> {
  const [row] = await connection
    .insert(bountyHunts)
    .values({
      userId,
      bountyId,
      startedAt,
      status: "ongoing",
    })
    .returning();

  return toHunt(row);
}

export async function findHuntById(
  connection: Transaction | typeof db,
  huntId: string,
): Promise<Hunt | undefined> {
  const [row] = await connection
    .select()
    .from(bountyHunts)
    .where(and(eq(bountyHunts.id, huntId)));

  return row ? toHunt(row) : undefined;
}

export async function findHuntByIdForUpdate(
  connection: Transaction,
  huntId: string,
): Promise<Hunt | undefined> {
  const [row] = await connection
    .select()
    .from(bountyHunts)
    .where(and(eq(bountyHunts.id, huntId)))
    .for("update");

  return row ? toHunt(row) : undefined;
}

export async function markHuntStopped(
  connection: Transaction,
  huntId: string,
  endedAt: Date,
): Promise<Hunt> {
  const [huntRow] = await connection
    .update(bountyHunts)
    .set({ status: "stopped", endedAt })
    .where(eq(bountyHunts.id, huntId))
    .returning();

  if (!huntRow) throw new Error("Hunt missing during stop");

  return toHunt(huntRow);
}

export async function closeOngoingHuntsForBounty(
  connection: Transaction,
  bountyId: string,
  endedAt: Date,
) {
  await connection
    .update(bountyHunts)
    .set({ status: "closed", endedAt })
    .where(
      and(
        eq(bountyHunts.bountyId, bountyId),
        eq(bountyHunts.status, "ongoing"),
      ),
    );
}

export async function findHuntsForScore(
  connection: Transaction,
  osuUserId: number,
  beatmapId: number,
  scoreEndedAt: Date,
): Promise<Hunt[]> {
  const rows = await connection
    .select({ hunt: bountyHunts })
    .from(bountyHunts)
    .innerJoin(users, eq(bountyHunts.userId, users.id))
    .innerJoin(bounties, eq(bountyHunts.bountyId, bounties.id))
    .where(
      and(
        eq(users.osuUserId, osuUserId),
        sql`(${bounties.goal}->>'beatmapId')::integer = ${beatmapId}`,
        sql`(${bountyHunts.startedAt} < ${scoreEndedAt}) AND (${bountyHunts.endedAt} IS NULL OR ${scoreEndedAt} <= ${bountyHunts.endedAt})`,
      ),
    );

  return rows.map(({ hunt }) => toHunt(hunt));
}
