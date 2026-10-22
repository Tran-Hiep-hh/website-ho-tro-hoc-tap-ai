import { httpError } from "../utils/httpError.js";
import { withTransaction } from "../repositories/withTransaction.js";

const missing = () => httpError(404, "Không tìm thấy Quiz hoặc lượt làm của bạn.");
const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

export function createQuizContentService(repository, difficulties, database) {
  return {
    async runInTransaction(work) {
      return withTransaction(database, work);
    },
    async owned(executor, ownerId, id, lock = false) {
      if (!validId(id)) throw missing();
      const { rows } = await repository.findOwned(id, ownerId, lock, executor);
      if (!rows[0]) throw missing();
      return rows[0];
    },
    async questions(executor, versionId) {
      return repository.findQuestions(versionId, executor);
    },
    async content(executor, row) {
      const { rows: versions } = await repository.findLatestVersion(row.content_id, executor);
      const { rows: docs } = await repository.findSources(row.content_id, executor);
      const version = versions[0];
      return {
        id: String(row.content_id), persisted: true, type: "QUIZ", title: row.title, status: row.status,
        difficulty: Object.keys(difficulties).find((key) => difficulties[key] === row.difficulty),
        createdAt: row.created_at, sources: docs.map((document) => String(document.document_id)),
        contentRequest: row.generation_settings.contentRequest ?? "", generationMode: row.generation_settings.mode ?? "MOCK",
        generationModel: row.generation_settings.model, versionId: String(version.quiz_version_id),
        questions: await repository.findQuestions(version.quiz_version_id, executor),
      };
    },
  };
}
