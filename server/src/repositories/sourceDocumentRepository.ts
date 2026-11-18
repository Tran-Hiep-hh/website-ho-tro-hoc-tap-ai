import { pool } from "../config/database.js";
import type { ISourceDocumentRepository } from "../interfaces/repositoryInterfaces.js";

export class SourceDocumentRepository implements ISourceDocumentRepository {
  constructor(private readonly database: any = pool) {}

async findReadyOwned(userId, documentIds) {
  const result = await this.database.query(
    "SELECT document_id,file_name,extracted_text FROM source_documents WHERE document_id=ANY($1::bigint[]) AND owner_id=$2 AND status='READY' AND length(trim(extracted_text)) > 0 FOR SHARE",
    [documentIds, userId],
  );
  return { rows: result.rows, count: result.rowCount };
}
}

export function createSourceDocumentRepository(database: any = pool): ISourceDocumentRepository {
  return new SourceDocumentRepository(database);
}
