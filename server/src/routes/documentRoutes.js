import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { pool } from "../config/database.js";
import { env } from "../config/env.js";
import { requireAuth, authRateLimit } from "../middlewares/auth.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { httpError } from "../utils/httpError.js";

const root = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)), env.uploadDir);
const missing = () => httpError(404, "Tài liệu không tồn tại hoặc bạn không có quyền truy cập.");
const publicDocument = (row) => ({
  id: String(row.document_id), ownerId: String(row.owner_id), name: row.file_name,
  type: row.file_type, size: `${(Number(row.file_size) / 1024).toFixed(1)} KB`,
  date: row.created_at, status: row.status, text: row.extracted_text ?? "",
});

async function extract(file, type) {
  if (type === "TXT") return new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
  if (type === "DOCX") {
    if (file.buffer.readUInt16LE(0) !== 0x4b50) throw new Error("Invalid DOCX");
    return (await mammoth.extractRawText({ buffer: file.buffer })).value;
  }
  if (file.buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF");
  const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
  try { return (await parser.getText()).pages.map((page) => page.text).join("\n\n"); }
  finally { await parser.destroy(); }
}

export function createDocumentRouter({ database = pool, authRepository = createAuthRepository(), storageRoot = root } = {}) {
  const router = Router();
  router.use(requireAuth(createAuthService(authRepository)));
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 1, fields: 0 } }).single("file");
  async function owned(req, allowShared = false) {
    if (!/^[1-9]\d{0,18}$/.test(req.params.id) || BigInt(req.params.id) > 9223372036854775807n) throw missing();
    const result = await database.query("SELECT d.* FROM source_documents d WHERE d.document_id=$1 AND d.status <> 'DELETED' AND (d.owner_id=$2 OR ($3::boolean AND EXISTS(SELECT 1 FROM class_materials cm JOIN classrooms c USING(class_id) JOIN class_memberships m USING(class_id) WHERE cm.document_id=d.document_id AND c.status='ACTIVE' AND m.student_id=$2 AND m.status='ACTIVE')))", [req.params.id, req.user.userId, allowShared]);
    if (!result.rows[0]) throw missing();
    return result.rows[0];
  }
  router.get("/", async (req, res) => {
    const result = await database.query("SELECT * FROM source_documents WHERE owner_id=$1 AND status <> 'DELETED' ORDER BY created_at DESC, document_id DESC", [req.user.userId]);
    res.json({ success: true, documents: result.rows.map(publicDocument) });
  });
  router.post("/", authRateLimit(30, 15 * 60_000), (req, res, next) => {
    upload(req, res, (error) => next(error ? httpError(400, `Chỉ tải một tệp PDF, DOCX hoặc TXT, tối đa ${env.maxFileSizeMb} MB.`) : undefined));
  }, async (req, res) => {
    const file = req.file;
    if (!file || !file.size) throw httpError(400, "Vui lòng chọn tệp có nội dung.");
    let originalName = file.originalname;
    try { originalName = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(originalName, "latin1")); } catch { /* Keep legacy filenames. */ }
    const name = path.basename(originalName.replaceAll("\\", "/")).replace(/[\x00-\x1f\x7f]/g, "");
    const type = path.extname(name).slice(1).toUpperCase();
    if (!["PDF", "DOCX", "TXT"].includes(type) || name.length > 255) throw httpError(400, "Chỉ nhận PDF, DOCX hoặc TXT có tên tối đa 255 ký tự.");
    let text;
    try { text = (await extract(file, type)).replaceAll("\u0000", "").trim(); }
    catch { throw httpError(422, "Không đọc được tệp. Kiểm tra định dạng, mật khẩu bảo vệ hoặc mã hóa UTF-8 của tệp TXT."); }
    if (text.length > 2_000_000) throw httpError(422, "Nội dung quá dài. Vui lòng chia tài liệu thành các phần nhỏ hơn.");
    const filename = `${randomUUID()}.${type.toLowerCase()}`;
    await mkdir(storageRoot, { recursive: true });
    const target = path.join(storageRoot, filename);
    await writeFile(target, file.buffer, { flag: "wx" });
    try {
      const result = await database.query("INSERT INTO source_documents (owner_id,file_name,file_type,storage_path,file_size,extracted_text,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [req.user.userId, name, type, filename, file.size, text, text ? "READY" : "FAILED"]);
      res.status(201).json({ success: true, document: publicDocument(result.rows[0]) });
    } catch (error) { await unlink(target).catch(() => {}); throw error; }
  });
  router.get("/:id", async (req, res) => res.json({ success: true, document: publicDocument(await owned(req, true)) }));
  router.get("/:id/download", async (req, res, next) => {
    const row = await owned(req, true);
    if (path.basename(row.storage_path) !== row.storage_path) throw missing();
    res.download(row.storage_path, row.file_name, { root: storageRoot, dotfiles: "deny" }, (error) => {
      if (error && !res.headersSent) next(error.code === "ENOENT" ? missing() : error);
    });
  });
  router.delete("/:id", async (req, res) => {
    const row = await owned(req);
    const db = await database.connect();
    try {
      await db.query("BEGIN");
      // Serialize with class sharing before checking links in a fresh snapshot.
      const locked = await db.query("SELECT document_id FROM source_documents WHERE document_id=$1 AND owner_id=$2 AND status <> 'DELETED' FOR UPDATE", [row.document_id, req.user.userId]);
      if (!locked.rowCount) throw missing();
      const links = await db.query("SELECT 1 FROM class_materials WHERE document_id=$1", [row.document_id]);
      if (links.rowCount) throw httpError(409, "Hãy gỡ tài liệu khỏi lớp trước khi xóa.");
      await db.query("UPDATE source_documents SET status='DELETED',extracted_text=NULL WHERE document_id=$1", [row.document_id]);
      await db.query("COMMIT");
    } catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
    // Preserve the record for generated content references, remove the original file.
    if (path.basename(row.storage_path) === row.storage_path) {
      await unlink(path.join(storageRoot, row.storage_path)).catch((error) => {
        if (error.code !== "ENOENT") console.error("Document file cleanup failed", { documentId: row.document_id, code: error.code });
      });
    }
    res.json({ success: true });
  });
  return router;
}
