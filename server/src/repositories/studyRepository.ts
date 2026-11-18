import { pool } from "../config/database.js";
import type { IStudyRepository } from "../interfaces/repositoryInterfaces.js";

export class StudyRepository implements IStudyRepository {
  constructor(private readonly database: any = pool) {}

async listOwned(userId, executor = this.database) {
  return executor.query("SELECT * FROM generated_contents WHERE owner_id=$1 AND content_type IN ('FLASHCARD','MINDMAP') AND status <> 'DELETED' ORDER BY created_at DESC", [userId]);
}
async createContent(values, executor = this.database) {
  return executor.query("INSERT INTO generated_contents(owner_id,content_type,title,difficulty,status,generation_settings) VALUES ($1,$2,$3,$4,'READY',$5) RETURNING *", values);
}
async addSource(contentId, documentId, executor = this.database) {
  return executor.query("INSERT INTO content_sources(content_id,document_id) VALUES ($1,$2)", [contentId, documentId]);
}
async findCardsForWrite(contentId, executor = this.database) {
  return executor.query("SELECT * FROM flashcards WHERE content_id=$1", [contentId]);
}
async deleteRemovedCards(contentId, ids, executor = this.database) {
  return executor.query("DELETE FROM flashcards WHERE content_id=$1 AND NOT (flashcard_id=ANY($2::bigint[]))", [contentId, ids]);
}
async shiftCardOrder(contentId, executor = this.database) {
  return executor.query("UPDATE flashcards SET display_order=display_order+1000 WHERE content_id=$1", [contentId]);
}
async deleteProgress(cardId, executor = this.database) {
  return executor.query("DELETE FROM flashcard_progress WHERE flashcard_id=$1", [cardId]);
}
async updateCard(cardId, values, executor = this.database) {
  return executor.query("UPDATE flashcards SET front_text=$2,back_text=$3,keyword=$4,display_order=$5 WHERE flashcard_id=$1", [cardId, values.front, values.back, values.keyword, values.order]);
}
async insertCard(contentId, values, executor = this.database) {
  return executor.query("INSERT INTO flashcards(content_id,front_text,back_text,keyword,display_order) VALUES ($1,$2,$3,$4,$5)", [contentId, values.front, values.back, values.keyword, values.order]);
}
async deleteNodes(contentId, executor = this.database) {
  return executor.query("DELETE FROM mindmap_nodes WHERE content_id=$1", [contentId]);
}
async insertNode(contentId, values, executor = this.database) {
  return executor.query("INSERT INTO mindmap_nodes(content_id,parent_node_id,label,display_order) VALUES ($1,$2,$3,$4) RETURNING node_id", [contentId, values.parentId, values.label, values.order]);
}
async updateTitle(contentId, title, executor = this.database) {
  return executor.query("UPDATE generated_contents SET title=$2,revision=revision+1 WHERE content_id=$1 RETURNING *", [contentId, title]);
}
async findCard(contentId, cardId, executor = this.database) {
  return executor.query("SELECT 1 FROM flashcards WHERE flashcard_id=$1 AND content_id=$2", [cardId, contentId]);
}
async updateProgress(userId, cardId, remembered, executor = this.database) {
  return executor.query("INSERT INTO flashcard_progress(user_id,flashcard_id,remembered) VALUES ($1,$2,$3) ON CONFLICT(user_id,flashcard_id) DO UPDATE SET remembered=EXCLUDED.remembered,updated_at=NOW()", [userId, cardId, remembered]);
}
async hasContentLinks(contentId, executor = this.database) {
  return executor.query("SELECT 1 FROM class_materials WHERE content_id=$1", [contentId]);
}
async markDeleted(contentId, executor = this.database) {
  return executor.query("UPDATE generated_contents SET status='DELETED' WHERE content_id=$1", [contentId]);
}
async findOwned(contentId, ownerId, lock = false, executor = this.database) {
  return executor.query(`SELECT * FROM generated_contents WHERE content_id=$1 AND owner_id=$2 AND content_type IN ('FLASHCARD','MINDMAP') AND status <> 'DELETED'${lock ? " FOR UPDATE" : ""}`, [contentId, ownerId]);
}
async findSources(contentId, executor = this.database) {
  return executor.query("SELECT document_id FROM content_sources WHERE content_id=$1 ORDER BY document_id", [contentId]);
}
async findCards(contentId, ownerId, executor = this.database) {
  return executor.query("SELECT f.*, COALESCE(p.remembered,FALSE) AS remembered FROM flashcards f LEFT JOIN flashcard_progress p ON p.flashcard_id=f.flashcard_id AND p.user_id=$2 WHERE f.content_id=$1 ORDER BY f.display_order", [contentId, ownerId]);
}
async findNodes(contentId, executor = this.database) {
  return executor.query("SELECT * FROM mindmap_nodes WHERE content_id=$1 ORDER BY display_order", [contentId]);
}
}

export function createStudyRepository(database: any = pool): IStudyRepository {
  return new StudyRepository(database);
}
