import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./index";

const PgSessionStore = connectPgSimple(session);

export const sessionStore = new PgSessionStore({
  pool,
  tableName: "sessions",
  createTableIfMissing: false,
});
