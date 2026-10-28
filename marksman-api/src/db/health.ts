import { pool } from ".";

export async function checkDatabaseHealth() {
  const query = {
    text: "SELECT 1",
    query_timeout: 2000,
  };

  await pool.query(query);
}
