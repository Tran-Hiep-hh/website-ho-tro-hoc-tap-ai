import { readFile } from "node:fs/promises";
import { pool } from "../src/config/database.js";

try {
  const sql = await readFile(new URL("../../database/migrations/001_auth.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(await readFile(new URL("../../database/migrations/002_documents.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../../database/migrations/003_quizzes.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../../database/migrations/004_study_materials.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../../database/migrations/005_classes.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../../database/migrations/006_assignments.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../../database/migrations/007_cancel_join_request.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../../database/migrations/008_notifications.sql", import.meta.url), "utf8"));
    await client.query(await readFile(new URL("../../database/migrations/009_assignment_duration.sql", import.meta.url), "utf8"));
    await client.query("COMMIT");
    console.log("Đã cập nhật cấu trúc xác thực, tài liệu, học liệu và lớp học; dữ liệu hiện có được giữ nguyên.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
} catch (error) {
  console.error("Không thể cập nhật database:", error.code ?? error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
