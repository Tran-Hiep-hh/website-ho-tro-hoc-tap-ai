import { pool } from "../config/database.js";

export function createSourceDocumentRepository(database = pool) {
  return {
    async findReadyOwned(userId, documentIds) {
      const result = await database.query(
        "SELECT document_id,file_name,extracted_text FROM source_documents WHERE document_id=ANY($1::bigint[]) AND owner_id=$2 AND status='READY' AND length(trim(extracted_text)) > 0 FOR SHARE",
        [documentIds, userId],
      );
      return { rows: result.rows, count: result.rowCount };
    },
  };
}
