import { readFile } from "node:fs/promises";
import pg from "pg";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";

const schema = process.env.AUTH_E2E_SCHEMA;
if (!/^auth_e2e_[a-f0-9]{32}$/.test(schema ?? "")) throw new Error("Expected an isolated E2E schema");
const connectionString = process.env.TEST_DATABASE_URL ?? env.databaseUrl;
const database = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
await database.query(`CREATE SCHEMA ${schema}`);
await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
const server = createApp({ authRepository: createAuthRepository(database) }).listen(env.port, "127.0.0.1");
const shutdown = () => server.close(async () => { await database.end(); process.exit(0); });
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
