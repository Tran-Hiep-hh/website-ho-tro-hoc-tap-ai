// @ts-nocheck
import { httpError } from "../utils/httpError.js";
import { withTransaction } from "../repositories/withTransaction.js";
import type { IStudyContentService } from "../interfaces/serviceInterfaces.js";

const missing = () => httpError(404, "Không tìm thấy học liệu hoặc bạn không có quyền truy cập.");
const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

export class StudyContentService implements IStudyContentService {
  constructor(private readonly repository: any, private readonly difficulties: any, private readonly database: unknown) {}

  async runInTransaction<T>(work: (executor: unknown) => Promise<T>): Promise<T> {
    return withTransaction(this.database, work);
  }

  async owned(executor: unknown, userId: string, id: string, lock = false): Promise<unknown> {
    if (!validId(id)) throw missing();
    const { rows } = await this.repository.findOwned(id, userId, lock, executor);
    if (!rows[0]) throw missing();
    return rows[0];
  }

  async material(executor: unknown, row: any): Promise<unknown> {
      const { rows: docs } = await this.repository.findSources(row.content_id, executor);
      const result: any = { id: String(row.content_id), type: row.content_type, title: row.title, revision: row.revision, persisted: true, generationMode: row.generation_settings.mode ?? "MOCK", generationModel: row.generation_settings.model, contentRequest: row.generation_settings.contentRequest ?? "", difficulty: Object.keys(this.difficulties).find((key) => this.difficulties[key] === row.difficulty), sources: docs.map((document) => String(document.document_id)), createdAt: row.created_at };
      if (row.content_type === "FLASHCARD") {
        const { rows } = await this.repository.findCards(row.content_id, row.owner_id, executor);
        result.cards = rows.map((card) => ({ id: String(card.flashcard_id), front: card.front_text, back: card.back_text, keyword: card.keyword }));
        result.learned = rows.flatMap((card, index) => card.remembered ? [index] : []);
      } else {
        const { rows } = await this.repository.findNodes(row.content_id, executor);
        result.nodes = rows.map((node) => ({ id: String(node.node_id), parent: node.parent_node_id === null ? null : String(node.parent_node_id), label: node.label }));
      }
      return result;
  }
}

export function createStudyContentService(repository: any, difficulties: any, database: unknown): IStudyContentService {
  return new StudyContentService(repository, difficulties, database);
}
