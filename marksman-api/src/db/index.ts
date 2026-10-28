import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { config } from "../config";

const connectionString = config.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle({ client: pool, schema });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
