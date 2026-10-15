import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { User } from "@marksman/contracts";
import type { CreateUserInput } from "../models/user";
import { db, Transaction } from "./index";
import { users } from "./schema";
import { createInitialGrantLedgerEntry } from "./ledger";

function toUser(row: typeof users.$inferSelect): User {
  return {
    identity: {
      id: row.id,
      username: row.username,
      osuUserId: row.osuUserId,
    },
    stats: {
      bpBalance: row.bpBalance,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(): Promise<User[]> {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  return rows.map(toUser);
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id));

  return row ? toUser(row) : undefined;
}

export async function findUserByIdForUpdate(
  connection: Transaction,
  userId: string,
): Promise<User | undefined> {
  const [row] = await connection
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .for("update");

  return row ? toUser(row) : undefined;
}

export async function findUserByOsuId(
  osuUserId: number,
  connection: typeof db | Transaction = db,
): Promise<User | undefined> {
  const [row] = await connection
    .select()
    .from(users)
    .where(eq(users.osuUserId, osuUserId));

  return row ? toUser(row) : undefined;
}

export async function upsertUserFromOsuProfile(
  tx: Transaction,
  input: CreateUserInput,
): Promise<User> {
  // the initial BP grant of a fresh user account
  const INITIAL_GRANT = 330;

  // this tries to insert a new user in the table, failing if a user with the same osu! id already exists
  const [newUser] = await tx
    .insert(users)
    .values({
      osuUserId: input.osuUserId,
      username: input.username,
      bpBalance: INITIAL_GRANT,
    })
    .onConflictDoNothing({ target: users.osuUserId })
    .returning();

  if (!newUser) {
    // this updates the existing user's username in case it changed since the last log-in
    const [existingUser] = await tx
      .update(users)
      .set({ username: input.username })
      .where(eq(users.osuUserId, input.osuUserId))
      .returning();

    return toUser(existingUser);
  } else {
    await createInitialGrantLedgerEntry(tx, newUser.id, INITIAL_GRANT);
    return toUser(newUser);
  }
}

export async function deductUserBp(
  tx: Transaction,
  creatorOsuUserId: number,
  deductedBp: number,
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const [updatedUser] = await tx
    .update(users)
    .set({ bpBalance: sql`${users.bpBalance} - ${deductedBp}` })
    .where(
      and(
        eq(users.osuUserId, creatorOsuUserId),
        gte(users.bpBalance, deductedBp),
      ),
    )
    .returning({ id: users.id });

  if (updatedUser) {
    return {
      ok: true,
      userId: updatedUser.id,
    };
  } else {
    return { ok: false };
  }
}

export async function creditUserBp(
  tx: Transaction,
  osuUserId: number,
  creditedBp: number,
): Promise<{ ok: true; userId: string } | { ok: false }> {
  const [updatedUser] = await tx
    .update(users)
    .set({ bpBalance: sql`${users.bpBalance} + ${creditedBp}` })
    .where(eq(users.osuUserId, osuUserId))
    .returning({ id: users.id });

  if (updatedUser) {
    return {
      ok: true,
      userId: updatedUser.id,
    };
  } else {
    return { ok: false };
  }
}
