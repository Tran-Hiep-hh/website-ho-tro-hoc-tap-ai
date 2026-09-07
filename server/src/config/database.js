import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
  console.error("Kết nối PostgreSQL gặp lỗi:", error.message);
});

export async function checkDatabaseConnection() {
  const result = await pool.query("SELECT NOW() AS current_time");
  return result.rows[0];
}
