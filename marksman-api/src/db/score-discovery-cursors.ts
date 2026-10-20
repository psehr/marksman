import { eq } from "drizzle-orm";
import { db, Transaction } from ".";
import { scoreDiscoveryCursors } from "./schema";

export async function upsertCursor(
  connection: Transaction | typeof db,
  stream: string,
  cursor: string,
) {
  const now = new Date();

  const [row] = await connection
    .insert(scoreDiscoveryCursors)
    .values({ stream, cursor, updatedAt: now })
    .onConflictDoUpdate({
      target: scoreDiscoveryCursors.stream,
      set: { cursor, updatedAt: now },
    })
    .returning();

  return row;
}

export async function findCursorByStream(
  connection: Transaction | typeof db,
  stream: string,
): Promise<string | undefined> {
  const [row] = await connection
    .select()
    .from(scoreDiscoveryCursors)
    .where(eq(scoreDiscoveryCursors.stream, stream));

  return row?.cursor;
}
