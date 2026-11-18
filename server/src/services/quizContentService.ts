// @ts-nocheck
import { httpError } from "../utils/httpError.js";
import { withTransaction } from "../repositories/withTransaction.js";
import type { IQuizContentService } from "../interfaces/serviceInterfaces.js";

const missing = () => httpError(404, "Không tìm thấy Quiz hoặc lượt làm của bạn.");
const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

export class QuizContentService implements IQuizContentService {
  constructor(private readonly repository: any, private readonly difficulties: any, private readonly database: unknown) {}

  async runInTransaction<T>(work: (executor: unknown) => Promise<T>): Promise<T> {
    return withTransaction(this.database, work);
  }

  async owned(executor: unknown, ownerId: string, id: string, lock = false): Promise<unknown> {
    if (!validId(id)) throw missing();
    const { rows } = await this.repository.findOwned(id, ownerId, lock, executor);
    if (!rows[0]) throw missing();
    return rows[0];
  }

  async questions(executor: unknown, versionId: string): Promise<unknown[]> {
    return this.repository.findQuestions(versionId, executor);
  }

  async content(executor: unknown, row: any): Promise<unknown> {
      const { rows: versions } = await this.repository.findLatestVersion(row.content_id, executor);
      const { rows: docs } = await this.repository.findSources(row.content_id, executor);
      const version = versions[0];
      return {
        id: String(row.content_id), persisted: true, type: "QUIZ", title: row.title, status: row.status,
        difficulty: Object.keys(this.difficulties).find((key) => this.difficulties[key] === row.difficulty),
        createdAt: row.created_at, sources: docs.map((document) => String(document.document_id)),
        contentRequest: row.generation_settings.contentRequest ?? "", generationMode: row.generation_settings.mode ?? "MOCK",
        generationModel: row.generation_settings.model, versionId: String(version.quiz_version_id),
        questions: await this.repository.findQuestions(version.quiz_version_id, executor),
      };
  }
}

export function createQuizContentService(repository: any, difficulties: any, database: unknown): IQuizContentService {
  return new QuizContentService(repository, difficulties, database);
}
