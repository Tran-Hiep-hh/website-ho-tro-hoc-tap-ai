import { pool } from "../config/database.js";
import type { IClassRepository } from "../interfaces/repositoryInterfaces.js";

export class ClassRepository implements IClassRepository {
  constructor(private readonly database: any = pool) {}

async findVisible(userId, executor = this.database) {
  await executor.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  const { rows: classes } = await executor.query("SELECT c.*,u.full_name AS teacher, EXISTS(SELECT 1 FROM class_memberships m WHERE m.class_id=c.class_id AND m.student_id=$1 AND m.status='ACTIVE') AS joined, EXISTS(SELECT 1 FROM join_requests r WHERE r.class_id=c.class_id AND r.student_id=$1 AND r.status='PENDING') AS pending FROM classrooms c JOIN users u ON u.user_id=c.teacher_id WHERE c.status='ACTIVE' AND (c.teacher_id=$1 OR EXISTS(SELECT 1 FROM class_memberships m WHERE m.class_id=c.class_id AND m.student_id=$1 AND m.status='ACTIVE') OR EXISTS(SELECT 1 FROM join_requests r WHERE r.class_id=c.class_id AND r.student_id=$1 AND r.status='PENDING')) ORDER BY c.class_id DESC", [userId]);
  const accessible = classes.filter((row) => row.joined || String(row.teacher_id) === String(userId)).map((row) => row.class_id);
  const owned = classes.filter((row) => String(row.teacher_id) === String(userId)).map((row) => row.class_id);
  const { rows: pendingRequests } = await executor.query("SELECT class_id,request_id FROM join_requests WHERE student_id=$1 AND status='PENDING'", [userId]);
  for (const row of classes) row.pendingRequestId = pendingRequests.find((request) => request.class_id === row.class_id)?.request_id ?? null;
  const { rows: members } = await executor.query("SELECT m.*,u.full_name,u.email FROM class_memberships m JOIN users u ON u.user_id=m.student_id WHERE m.class_id=ANY($1::bigint[]) AND m.status='ACTIVE' ORDER BY m.membership_id", [accessible]);
  const { rows: requests } = await executor.query("SELECT r.*,u.full_name,u.email FROM join_requests r JOIN users u ON u.user_id=r.student_id WHERE r.class_id=ANY($1::bigint[]) AND r.status='PENDING' ORDER BY r.request_id", [owned]);
  const { rows: links } = await executor.query("SELECT cm.class_id,d.* FROM class_materials cm JOIN source_documents d USING(document_id) WHERE cm.class_id=ANY($1::bigint[]) AND d.status <> 'DELETED' ORDER BY cm.class_material_id", [accessible]);
  return { classes, members, requests, links };
}
async findForUpdate(classId, executor = this.database) {
  return executor.query("SELECT * FROM classrooms WHERE class_id=$1 AND status='ACTIVE' FOR UPDATE", [classId]);
}
async hasActiveQuiz(classId, executor = this.database) {
  return executor.query("SELECT 1 FROM quiz_assignments WHERE class_id=$1 AND status='PUBLISHED' AND start_at<=NOW() AND due_at>NOW()", [classId]);
}
async update(classId, values, executor = this.database) {
  return executor.query("UPDATE classrooms SET class_name=$2,group_name=$3,description=$4 WHERE class_id=$1", [classId, values.name, values.group, values.description]);
}
async hasMembershipOrRequest(classId, userId, executor = this.database) {
  return executor.query("SELECT 1 FROM class_memberships WHERE class_id=$1 AND student_id=$2 AND status='ACTIVE' UNION ALL SELECT 1 FROM join_requests WHERE class_id=$1 AND student_id=$2 AND status='PENDING'", [classId, userId]);
}
async createJoinRequest(classId, userId, executor = this.database) {
  return executor.query("INSERT INTO join_requests(class_id,student_id) VALUES ($1,$2)", [classId, userId]);
}
async cancelJoinRequest(requestId, classId, userId, executor = this.database) {
  return executor.query("UPDATE join_requests SET status='CANCELLED' WHERE request_id=$1 AND class_id=$2 AND student_id=$3 AND status='PENDING'", [requestId, classId, userId]);
}
async findPendingRequest(requestId, classId, executor = this.database) {
  return executor.query("SELECT * FROM join_requests WHERE request_id=$1 AND class_id=$2 AND status='PENDING' FOR UPDATE", [requestId, classId]);
}
async setRequestStatus(requestId, status, executor = this.database) {
  return executor.query("UPDATE join_requests SET status=$2 WHERE request_id=$1", [requestId, status]);
}
async addMembership(classId, userId, executor = this.database) {
  return executor.query("INSERT INTO class_memberships(class_id,student_id,status) VALUES ($1,$2,'ACTIVE') ON CONFLICT(class_id,student_id) DO UPDATE SET status='ACTIVE'", [classId, userId]);
}
async removeMember(membershipId, classId, executor = this.database) {
  return executor.query("UPDATE class_memberships SET status='REMOVED' WHERE membership_id=$1 AND class_id=$2 AND status='ACTIVE'", [membershipId, classId]);
}
async leave(classId, userId, executor = this.database) {
  return executor.query("UPDATE class_memberships SET status='LEFT' WHERE class_id=$1 AND student_id=$2 AND status='ACTIVE'", [classId, userId]);
}
async findShareableDocuments(documentIds, ownerId, executor = this.database) {
  return executor.query("SELECT document_id FROM source_documents WHERE document_id=ANY($1::bigint[]) AND owner_id=$2 AND status IN ('READY','FAILED') FOR UPDATE", [documentIds, ownerId]);
}
async addMaterial(classId, documentId, executor = this.database) {
  return executor.query("INSERT INTO class_materials(class_id,document_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [classId, documentId]);
}
async removeMaterial(classId, documentId, executor = this.database) {
  return executor.query("DELETE FROM class_materials WHERE class_id=$1 AND document_id=$2", [classId, documentId]);
}
async deleteCascade(classId, executor = this.database) {
  await executor.query("UPDATE quiz_assignments SET status='CANCELLED',deleted_at=COALESCE(deleted_at,NOW()) WHERE class_id=$1", [classId]);
  await executor.query("DELETE FROM quiz_attempts WHERE assignment_id IN (SELECT assignment_id FROM quiz_assignments WHERE class_id=$1)", [classId]);
  await executor.query("UPDATE classrooms SET status='DELETED' WHERE class_id=$1", [classId]);
  await executor.query("UPDATE join_requests SET status='REJECTED' WHERE class_id=$1 AND status='PENDING'", [classId]);
  await executor.query("UPDATE class_memberships SET status='REMOVED' WHERE class_id=$1", [classId]);
  await executor.query("DELETE FROM class_materials WHERE class_id=$1", [classId]);
}
async findActiveByJoinCode(code) {
  const { rows } = await this.database.query(
    "SELECT c.*,u.full_name AS teacher FROM classrooms c JOIN users u ON u.user_id=c.teacher_id WHERE c.join_code=$1 AND c.status='ACTIVE'",
    [code],
  );
  return rows[0];
}
async create({ teacherId, name, group, description, joinCode }) {
  const { rows } = await this.database.query(
    "INSERT INTO classrooms(teacher_id,class_name,group_name,description,join_code) VALUES ($1,$2,$3,$4,$5) RETURNING class_id",
    [teacherId, name, group, description, joinCode],
  );
  return rows[0];
}
}

export function createClassRepository(database: any = pool): IClassRepository {
  return new ClassRepository(database);
}
