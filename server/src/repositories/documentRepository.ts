import type { IDocumentRepository } from "../interfaces/repositoryInterfaces.js";

export class DocumentRepository implements IDocumentRepository {
  constructor(private readonly database: any) {}

async findOwned(userId) {
  return this.database.query("SELECT * FROM source_documents WHERE owner_id=$1 AND status <> 'DELETED' ORDER BY created_at DESC, document_id DESC", [userId]);
}
async findAccessible(id, userId, allowShared) {
  return this.database.query("SELECT d.* FROM source_documents d WHERE d.document_id=$1 AND d.status <> 'DELETED' AND (d.owner_id=$2 OR ($3::boolean AND EXISTS(SELECT 1 FROM class_materials cm JOIN classrooms c USING(class_id) JOIN class_memberships m USING(class_id) WHERE cm.document_id=d.document_id AND c.status='ACTIVE' AND m.student_id=$2 AND m.status='ACTIVE')))", [id, userId, allowShared]);
}
async lockOwned(databaseConnection, documentId, userId) {
  return databaseConnection.query("SELECT document_id FROM source_documents WHERE document_id=$1 AND owner_id=$2 AND status <> 'DELETED' FOR UPDATE", [documentId, userId]);
}
async linked(databaseConnection, documentId) {
  return databaseConnection.query("SELECT 1 FROM class_materials WHERE document_id=$1", [documentId]);
}
async markDeleted(databaseConnection, documentId) {
  return databaseConnection.query("UPDATE source_documents SET status='DELETED',extracted_text=NULL WHERE document_id=$1", [documentId]);
}
async insert(documentDatabase, values) {
  return documentDatabase.query("INSERT INTO source_documents (owner_id,file_name,file_type,storage_path,file_size,extracted_text,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", values);
}
}

export function createDocumentRepository(database: any): IDocumentRepository {
  return new DocumentRepository(database);
}
