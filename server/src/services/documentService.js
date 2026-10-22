import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractDocumentText } from "./documentFileService.js";
import { withTransaction } from "../repositories/withTransaction.js";
import { httpError } from "../utils/httpError.js";

const missing = () => httpError(404, "Tài liệu không tồn tại hoặc bạn không có quyền truy cập.");
const validId = (id) => /^[1-9]\d{0,18}$/.test(String(id)) && BigInt(id) <= 9223372036854775807n;

export const publicDocument = (row) => ({
  id: String(row.document_id), ownerId: String(row.owner_id), name: row.file_name,
  type: row.file_type, size: `${(Number(row.file_size) / 1024).toFixed(1)} KB`,
  date: row.created_at, status: row.status, text: row.extracted_text ?? "",
});

export function createDocumentService({ database, repository, storageRoot, maxFileSizeMb }) {
  async function owned(userId, id, allowShared = false) {
    if (!validId(id)) throw missing();
    const result = await repository.findAccessible(id, userId, allowShared);
    if (!result.rows[0]) throw missing();
    return result.rows[0];
  }

  return {
    async list(userId) {
      const result = await repository.findOwned(userId);
      return result.rows.map(publicDocument);
    },
    async get(userId, id) {
      return publicDocument(await owned(userId, id, true));
    },
    async upload(userId, file) {
      if (!file || !file.size) throw httpError(400, "Vui lòng chọn tệp có nội dung.");
      let originalName = file.originalname;
      try { originalName = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(originalName, "latin1")); } catch { /* Keep legacy filenames. */ }
      const name = path.basename(originalName.replaceAll("\\", "/")).replace(/[\x00-\x1f\x7f]/g, "");
      const type = path.extname(name).slice(1).toUpperCase();
      if (!["PDF", "DOCX", "TXT"].includes(type) || name.length > 255) throw httpError(400, "Chỉ nhận PDF, DOCX hoặc TXT có tên tối đa 255 ký tự.");
      let text;
      try { text = (await extractDocumentText(file, type)).replaceAll("\u0000", "").trim(); }
      catch { throw httpError(422, "Không đọc được tệp. Kiểm tra định dạng, mật khẩu bảo vệ hoặc mã hóa UTF-8 của tệp TXT."); }
      if (text.length > 2_000_000) throw httpError(422, "Nội dung quá dài. Vui lòng chia tài liệu thành các phần nhỏ hơn.");
      const filename = `${randomUUID()}.${type.toLowerCase()}`;
      await mkdir(storageRoot, { recursive: true });
      const target = path.join(storageRoot, filename);
      await writeFile(target, file.buffer, { flag: "wx" });
      try {
        const result = await repository.insert(database, [userId, name, type, filename, file.size, text, text ? "READY" : "FAILED"]);
        return publicDocument(result.rows[0]);
      } catch (error) { await unlink(target).catch(() => {}); throw error; }
    },
    async download(userId, id) {
      const row = await owned(userId, id, true);
      if (path.basename(row.storage_path) !== row.storage_path) throw missing();
      return row;
    },
    async remove(userId, id) {
      const row = await owned(userId, id);
      await withTransaction(database, async (db) => {
        const locked = await repository.lockOwned(db, row.document_id, userId);
        if (!locked.rowCount) throw missing();
        const links = await repository.linked(db, row.document_id);
        if (links.rowCount) throw httpError(409, "Hãy gỡ tài liệu khỏi lớp trước khi xóa.");
        await repository.markDeleted(db, row.document_id);
      });
      if (path.basename(row.storage_path) === row.storage_path) {
        await unlink(path.join(storageRoot, row.storage_path)).catch((error) => {
          if (error.code !== "ENOENT") console.error("Document file cleanup failed", { documentId: row.document_id, code: error.code });
        });
      }
    },
  };
}
