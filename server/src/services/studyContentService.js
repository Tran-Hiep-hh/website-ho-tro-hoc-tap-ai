import { httpError } from "../utils/httpError.js";
import { withTransaction } from "../repositories/withTransaction.js";

const missing = () => httpError(404, "Không tìm thấy học liệu hoặc bạn không có quyền truy cập.");
const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

export function createStudyContentService(repository, difficulties, database) {
  return {
    async runInTransaction(work) {
      return withTransaction(database, work);
    },
    async owned(executor, userId, id, lock = false) {
      if (!validId(id)) throw missing();
      const { rows } = await repository.findOwned(id, userId, lock, executor);
      if (!rows[0]) throw missing();
      return rows[0];
    },
    async material(executor, row) {
      const { rows: docs } = await repository.findSources(row.content_id, executor);
      const result = { id: String(row.content_id), type: row.content_type, title: row.title, revision: row.revision, persisted: true, generationMode: row.generation_settings.mode ?? "MOCK", generationModel: row.generation_settings.model, contentRequest: row.generation_settings.contentRequest ?? "", difficulty: Object.keys(difficulties).find((key) => difficulties[key] === row.difficulty), sources: docs.map((document) => String(document.document_id)), createdAt: row.created_at };
      if (row.content_type === "FLASHCARD") {
        const { rows } = await repository.findCards(row.content_id, row.owner_id, executor);
        result.cards = rows.map((card) => ({ id: String(card.flashcard_id), front: card.front_text, back: card.back_text, keyword: card.keyword }));
        result.learned = rows.flatMap((card, index) => card.remembered ? [index] : []);
      } else {
        const { rows } = await repository.findNodes(row.content_id, executor);
        result.nodes = rows.map((node) => ({ id: String(node.node_id), parent: node.parent_node_id === null ? null : String(node.parent_node_id), label: node.label }));
      }
      return result;
    },
  };
}
