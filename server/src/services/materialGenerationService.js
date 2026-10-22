import { httpError } from "../utils/httpError.js";
import { generateQuiz } from "./quizGenerator.js";
import { generateStudyMaterial } from "./studyGenerator.js";

export function createMaterialGenerationService({ sourceDocumentRepository, quizGenerator = generateQuiz, studyGenerator = generateStudyMaterial }) {
  async function sources(userId, documentIds) {
    const result = await sourceDocumentRepository.findReadyOwned(userId, documentIds);
    if (result.count !== documentIds.length) {
      throw httpError(400, "Tài liệu nguồn phải thuộc về bạn, còn tồn tại và có văn bản sẵn sàng.");
    }
    return documentIds.map((id) => result.rows.find((row) => String(row.document_id) === id));
  }

  return {
    async generateQuiz(userId, input) {
      return quizGenerator({ ...input, documents: await sources(userId, input.sources) });
    },
    async generateStudyMaterial(userId, input) {
      return studyGenerator({ ...input, documents: await sources(userId, input.sources) });
    },
  };
}
