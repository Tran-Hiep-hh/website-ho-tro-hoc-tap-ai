// @ts-nocheck
import { httpError } from "../utils/httpError.js";
import { generateQuiz } from "./quizGenerator.js";
import { generateStudyMaterial } from "./studyGenerator.js";
import type { IMaterialGenerationService } from "../interfaces/serviceInterfaces.js";

export class MaterialGenerationService implements IMaterialGenerationService {
  constructor(private readonly options: { sourceDocumentRepository: any; quizGenerator?: any; studyGenerator?: any }) {}

  private async sources(userId: string, documentIds: string[]) {
    const result = await this.options.sourceDocumentRepository.findReadyOwned(userId, documentIds);
    if (result.count !== documentIds.length) {
      throw httpError(400, "Tài liệu nguồn phải thuộc về bạn, còn tồn tại và có văn bản sẵn sàng.");
    }
    return documentIds.map((id) => result.rows.find((row) => String(row.document_id) === id));
  }

  async generateQuiz(userId: string, input: any): Promise<unknown> {
    const generator = this.options.quizGenerator ?? generateQuiz;
    return generator({ ...input, documents: await this.sources(userId, input.sources) });
  }

  async generateStudyMaterial(userId: string, input: any): Promise<unknown> {
    const generator = this.options.studyGenerator ?? generateStudyMaterial;
    return generator({ ...input, documents: await this.sources(userId, input.sources) });
  }
}

export function createMaterialGenerationService(options: { sourceDocumentRepository: any; quizGenerator?: any; studyGenerator?: any }): IMaterialGenerationService {
  return new MaterialGenerationService(options);
}
