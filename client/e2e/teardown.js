import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

export default async function teardown(config) {
  dotenv.config({ path: fileURLToPath(new URL("../../server/.env", import.meta.url)), quiet: true });
  const schema = config.metadata.e2eSchema;
  if (!/^auth_e2e_[a-f0-9]{32}$/.test(schema ?? "")) throw new Error("Refusing to remove an unknown schema");
  const database = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/study_ai",
    connectionTimeoutMillis: 5000,
  });
  try { await database.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
  finally { await database.end(); }
}
