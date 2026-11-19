// @ts-nocheck
import { randomUUID } from "node:crypto";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractDocumentText } from "./documentFileService.js";
import { withTransaction } from "../repositories/withTransaction.js";
import { httpError } from "../utils/httpError.js";
import type { IDocumentService } from "../interfaces/serviceInterfaces.js";

const missing = () => httpError(404, "Tài liệu không tồn tại hoặc bạn không có quyền truy cập.");
const validId = (id) => /^[1-9]\d{0,18}$/.test(String(id)) && BigInt(id) <= 9223372036854775807n;

export const publicDocument = (row) => ({
  id: String(row.document_id), ownerId: String(row.owner_id), name: row.file_name,
  type: row.file_type, size: `${(Number(row.file_size) / 1024).toFixed(1)} KB`,
  date: row.created_at, status: row.status, text: row.extracted_text ?? "",
});

export class DocumentService implements IDocumentService {
  public readonly storageRoot: string;

  constructor(private readonly options: { database: any; repository: any; storageRoot: string; legacyStorageRoot?: string; maxFileSizeMb?: number }) {
    this.storageRoot = options.storageRoot;
  }

  private async owned(userId: string, id: string, allowShared = false) {
    const { repository } = this.options;
    if (!validId(id)) throw missing();
    const result = await repository.findAccessible(id, userId, allowShared);
    if (!result.rows[0]) throw missing();
    return result.rows[0];
  }

  async list(userId: string): Promise<unknown[]> {
    const result = await this.options.repository.findOwned(userId);
    return result.rows.map(publicDocument);
  }

  async get(userId: string, id: string): Promise<unknown> {
    return publicDocument(await this.owned(userId, id, true));
  }

  async upload(userId: string, file: any): Promise<unknown> {
      if (!file || !file.size) throw httpError(400, "Vui lòng chọn tệp có nội dung.");
      let originalName = file.originalname;
      try { originalName = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(originalName, "latin1")); } catch { /* Keep legacy filenames. */ }
      const name = path.basename(originalName.replaceAll("\\", "/")).replace(/[\x00-\x1f\x7f]/g, "");
      const type = path.extname(name).slice(1).toUpperCase();
      if (!["PDF", "DOCX", "TXT"].includes(type) || name.length > 255) throw httpError(400, "Chỉ nhận PDF, DOCX hoặc TXT có tên tối đa 255 ký tự.");
      const ownedDocuments = await this.options.repository.findOwned(userId);
      if (ownedDocuments.rows.some((row) => row.file_name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        throw httpError(409, "Tên tài liệu này đã tồn tại trong danh sách của bạn.");
      }
      let text;
      try { text = (await extractDocumentText(file, type)).replaceAll("\u0000", "").trim(); }
      catch { throw httpError(422, "Không đọc được tệp. Kiểm tra định dạng, mật khẩu bảo vệ hoặc mã hóa UTF-8 của tệp TXT."); }
      if (text.length > 2_000_000) throw httpError(422, "Nội dung quá dài. Vui lòng chia tài liệu thành các phần nhỏ hơn.");
      const filename = `${randomUUID()}.${type.toLowerCase()}`;
      await mkdir(this.options.storageRoot, { recursive: true });
      const target = path.join(this.options.storageRoot, filename);
      await writeFile(target, file.buffer, { flag: "wx" });
      try {
        const result = await this.options.repository.insert(this.options.database, [userId, name, type, filename, file.size, text, text ? "READY" : "FAILED"]);
        return publicDocument(result.rows[0]);
      } catch (error) { await unlink(target).catch(() => {}); throw error; }
  }

  async download(userId: string, id: string): Promise<unknown> {
      const row = await this.owned(userId, id, true);
      if (path.basename(row.storage_path) !== row.storage_path) throw missing();
      row.storageRoot = this.options.storageRoot;
      if (this.options.legacyStorageRoot && this.options.legacyStorageRoot !== this.options.storageRoot) {
        await access(path.join(this.options.storageRoot, row.storage_path)).catch(async () => {
          await access(path.join(this.options.legacyStorageRoot, row.storage_path));
          row.storageRoot = this.options.legacyStorageRoot;
        });
      }
      return row;
  }

  async remove(userId: string, id: string): Promise<void> {
      const row = await this.owned(userId, id);
      await withTransaction(this.options.database, async (db) => {
        const locked = await this.options.repository.lockOwned(db, row.document_id, userId);
        if (!locked.rowCount) throw missing();
        const links = await this.options.repository.linked(db, row.document_id);
        if (links.rowCount) throw httpError(409, "Hãy gỡ tài liệu khỏi lớp trước khi xóa.");
        await this.options.repository.markDeleted(db, row.document_id);
      });
      if (path.basename(row.storage_path) === row.storage_path) {
        await unlink(path.join(this.options.storageRoot, row.storage_path)).catch((error) => {
          if (error.code !== "ENOENT") console.error("Document file cleanup failed", { documentId: row.document_id, code: error.code });
        });
      }
  }
}

export function createDocumentService(options: { database: any; repository: any; storageRoot: string; maxFileSizeMb?: number }): IDocumentService {
  return new DocumentService(options);
}
