// @ts-nocheck
import { readFile } from "node:fs/promises";
import { pool } from "../src/config/database.js";

try {
  const sql = await readFile("../database/migrations/001_auth.sql", "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(await readFile("../database/migrations/002_documents.sql", "utf8"));
    await client.query(await readFile("../database/migrations/003_quizzes.sql", "utf8"));
    await client.query(await readFile("../database/migrations/004_study_materials.sql", "utf8"));
    await client.query(await readFile("../database/migrations/005_classes.sql", "utf8"));
    await client.query(await readFile("../database/migrations/006_assignments.sql", "utf8"));
    await client.query(await readFile("../database/migrations/007_cancel_join_request.sql", "utf8"));
    await client.query(await readFile("../database/migrations/008_notifications.sql", "utf8"));
    await client.query(await readFile("../database/migrations/009_assignment_duration.sql", "utf8"));
    await client.query(await readFile("../database/migrations/010_delete_assignments.sql", "utf8"));
    await client.query(await readFile("../database/migrations/011_remove_deleted_quiz_results.sql", "utf8"));
    await client.query(await readFile("../database/migrations/012_assignment_versions.sql", "utf8"));
    await client.query("COMMIT");
    console.log("Đã áp dụng migrations; đã dọn kết quả của Quiz, bài giao và lớp đã xóa.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
} catch (error) {
  console.error("Không thể cập nhật database:", error.code ?? error.message);
  process.exitCode = 1;
} finally { await pool.end(); }


