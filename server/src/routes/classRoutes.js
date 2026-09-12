import { Router } from "express";
import { randomBytes } from "node:crypto";
import { pool } from "../config/database.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation, authRateLimit } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";

const validId = (id) => /^[1-9]\d{0,18}$/.test(String(id)) && BigInt(id) <= 9223372036854775807n;
const missing = () => httpError(404, "Lớp không tồn tại hoặc bạn không có quyền truy cập.");
function text(value, max, required = true) {
  if (typeof value !== "string" || value.includes("\0") || value.length > max || (required && !value.trim())) throw httpError(400, "Thông tin lớp trống hoặc vượt độ dài cho phép.");
  return value.trim();
}
function fields(body = {}) {
  return { name: text(body?.name, 100), group: text(body?.group ?? "", 100, false), description: text(body?.description ?? "", 1000, false) };
}
function role(req, expected) {
  if (req.user.role !== expected) throw httpError(403, expected === "TEACHER" ? "Chỉ giáo viên được quản lý lớp học." : "Chỉ học sinh được gửi yêu cầu tham gia hoặc rời lớp.");
}
const basic = (row) => ({ id: String(row.class_id), persisted: true, name: row.class_name, group: row.group_name, description: row.description ?? "", code: row.join_code, teacher: row.teacher, teacherId: String(row.teacher_id), color: "green", materialIds: [], joined: false, pending: false });

export function createClassRouter({ database = pool, authRepository = createAuthRepository() } = {}) {
  const router = Router();
  router.use(requireAuth(createAuthService(authRepository)));
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : protectAuthMutation(req, res, next));
  async function transaction(fn) {
    const db = await database.connect();
    try { await db.query("BEGIN"); const value = await fn(db); await db.query("COMMIT"); return value; }
    catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
  }
  async function classRow(db, req, teacherOnly = false) {
    if (teacherOnly) role(req, "TEACHER");
    if (!validId(req.params.id)) throw missing();
    const { rows } = await db.query("SELECT * FROM classrooms WHERE class_id=$1 AND status='ACTIVE' FOR UPDATE", [req.params.id]);
    if (!rows[0] || (teacherOnly && String(rows[0].teacher_id) !== String(req.user.userId))) throw missing();
    return rows[0];
  }
  async function noActiveQuiz(db, classId) {
    const active = await db.query("SELECT 1 FROM quiz_assignments WHERE class_id=$1 AND status='PUBLISHED' AND start_at<=NOW() AND due_at>NOW()", [classId]);
    if (active.rowCount) throw httpError(409, "Lớp đang có Quiz diễn ra. Chờ bài giao kết thúc trước khi xóa, rời lớp hoặc xóa thành viên.");
  }
  router.get("/", async (req, res) => {
    const result = await transaction(async (db) => {
      // One snapshot avoids mixing membership changes with the returned materials.
      await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const { rows } = await db.query("SELECT c.*,u.full_name AS teacher, EXISTS(SELECT 1 FROM class_memberships m WHERE m.class_id=c.class_id AND m.student_id=$1 AND m.status='ACTIVE') AS joined, EXISTS(SELECT 1 FROM join_requests r WHERE r.class_id=c.class_id AND r.student_id=$1 AND r.status='PENDING') AS pending FROM classrooms c JOIN users u ON u.user_id=c.teacher_id WHERE c.status='ACTIVE' AND (c.teacher_id=$1 OR EXISTS(SELECT 1 FROM class_memberships m WHERE m.class_id=c.class_id AND m.student_id=$1 AND m.status='ACTIVE') OR EXISTS(SELECT 1 FROM join_requests r WHERE r.class_id=c.class_id AND r.student_id=$1 AND r.status='PENDING')) ORDER BY c.class_id DESC", [req.user.userId]);
      const accessible = rows.filter((row) => row.joined || String(row.teacher_id) === String(req.user.userId)).map((row) => row.class_id);
      const owned = rows.filter((row) => String(row.teacher_id) === String(req.user.userId)).map((row) => row.class_id);
      const { rows: mine } = await db.query("SELECT class_id,request_id FROM join_requests WHERE student_id=$1 AND status='PENDING'", [req.user.userId]);
      for (const row of rows) row.pendingRequestId = mine.find((request) => request.class_id === row.class_id)?.request_id ?? null;
      const { rows: members } = await db.query("SELECT m.*,u.full_name,u.email FROM class_memberships m JOIN users u ON u.user_id=m.student_id WHERE m.class_id=ANY($1::bigint[]) AND m.status='ACTIVE' ORDER BY m.membership_id", [accessible]);
      const { rows: requests } = await db.query("SELECT r.*,u.full_name,u.email FROM join_requests r JOIN users u ON u.user_id=r.student_id WHERE r.class_id=ANY($1::bigint[]) AND r.status='PENDING' ORDER BY r.request_id", [owned]);
      const { rows: links } = await db.query("SELECT cm.class_id,d.* FROM class_materials cm JOIN source_documents d USING(document_id) WHERE cm.class_id=ANY($1::bigint[]) AND d.status <> 'DELETED' ORDER BY cm.class_material_id", [accessible]);
      const docs = [...new Map(links.map((row) => [String(row.document_id), { id: String(row.document_id), ownerId: String(row.owner_id), name: row.file_name, type: row.file_type, size: `${(Number(row.file_size) / 1024).toFixed(1)} KB`, date: row.created_at, status: row.status, text: row.extracted_text ?? "" }])).values()];
      return { classes: rows.map((row) => ({ ...basic(row), pendingRequestId: row.pendingRequestId === null ? null : String(row.pendingRequestId), joined: row.joined || owned.includes(row.class_id), pending: row.pending && !row.joined, materialIds: links.filter((link) => link.class_id === row.class_id).map((link) => String(link.document_id)) })), members: members.map((row) => ({ id: String(row.membership_id), userId: String(row.student_id), classId: String(row.class_id), name: row.full_name, email: row.email })), requests: requests.map((row) => ({ id: String(row.request_id), userId: String(row.student_id), classId: String(row.class_id), name: row.full_name, email: row.email })), documents: docs };
    });
    res.json({ success: true, ...result });
  });
  router.post("/lookup", authRateLimit(30, 15 * 60_000), async (req, res) => {
    role(req, "STUDENT");
    const code = text(req.body?.code, 20).toUpperCase();
    const { rows } = await database.query("SELECT c.*,u.full_name AS teacher FROM classrooms c JOIN users u ON u.user_id=c.teacher_id WHERE c.join_code=$1 AND c.status='ACTIVE'", [code]);
    if (!rows[0]) throw httpError(404, "Không tìm thấy lớp với mã này.");
    res.json({ success: true, classroom: basic(rows[0]) });
  });
  router.post("/", async (req, res) => {
    role(req, "TEACHER");
    const input = fields(req.body);
    for (let i = 0; i < 3; i++) {
      try {
        const { rows } = await database.query("INSERT INTO classrooms(teacher_id,class_name,group_name,description,join_code) VALUES ($1,$2,$3,$4,$5) RETURNING class_id", [req.user.userId, input.name, input.group, input.description, randomBytes(5).toString("hex").toUpperCase()]);
        res.status(201).json({ success: true, id: String(rows[0].class_id) }); return;
      } catch (error) { if (error.code !== "23505") throw error; }
    }
    throw httpError(503, "Không tạo được mã lớp. Vui lòng thử lại.");
  });
  router.put("/:id", async (req, res) => {
    const input = fields(req.body);
    await transaction(async (db) => {
      const cls = await classRow(db, req, true);
      await db.query("UPDATE classrooms SET class_name=$2,group_name=$3,description=$4 WHERE class_id=$1", [cls.class_id, input.name, input.group, input.description]);
    });
    res.json({ success: true });
  });
  router.post("/:id/join", authRateLimit(30, 15 * 60_000), async (req, res) => {
    role(req, "STUDENT");
    await transaction(async (db) => {
      const cls = await classRow(db, req);
      if (text(req.body?.code, 20).toUpperCase() !== cls.join_code) throw missing();
      const existing = await db.query("SELECT 1 FROM class_memberships WHERE class_id=$1 AND student_id=$2 AND status='ACTIVE' UNION ALL SELECT 1 FROM join_requests WHERE class_id=$1 AND student_id=$2 AND status='PENDING'", [cls.class_id, req.user.userId]);
      if (existing.rowCount) throw httpError(409, "Bạn đã tham gia hoặc đang chờ duyệt lớp này.");
      await db.query("INSERT INTO join_requests(class_id,student_id) VALUES ($1,$2)", [cls.class_id, req.user.userId]);
    });
    res.status(201).json({ success: true });
  });
  router.delete("/:id/requests/:requestId", async (req, res) => {
    role(req, "STUDENT");
    if (!validId(req.params.requestId)) throw missing();
    await transaction(async (db) => {
      const cls = await classRow(db, req);
      // Use the same class lock as approval; cancel only this user's exact pending request.
      const result = await db.query("UPDATE join_requests SET status='CANCELLED' WHERE request_id=$1 AND class_id=$2 AND student_id=$3 AND status='PENDING'", [req.params.requestId, cls.class_id, req.user.userId]);
      if (!result.rowCount) throw httpError(409, "Yêu cầu không còn chờ duyệt hoặc không thuộc về bạn. Danh sách lớp sẽ được cập nhật; nếu đã được duyệt, bạn có thể chọn rời lớp.");
    });
    res.json({ success: true });
  });
  router.post("/:id/requests/:requestId", async (req, res) => {
    if (!validId(req.params.requestId) || typeof req.body?.approve !== "boolean") throw httpError(400, "Yêu cầu duyệt không hợp lệ.");
    await transaction(async (db) => {
      const cls = await classRow(db, req, true);
      const { rows } = await db.query("SELECT * FROM join_requests WHERE request_id=$1 AND class_id=$2 AND status='PENDING' FOR UPDATE", [req.params.requestId, cls.class_id]);
      if (!rows[0]) throw httpError(409, "Yêu cầu đã được xử lý hoặc không thuộc lớp.");
      await db.query("UPDATE join_requests SET status=$2 WHERE request_id=$1", [rows[0].request_id, req.body.approve ? "APPROVED" : "REJECTED"]);
      if (req.body.approve) await db.query("INSERT INTO class_memberships(class_id,student_id,status) VALUES ($1,$2,'ACTIVE') ON CONFLICT(class_id,student_id) DO UPDATE SET status='ACTIVE'", [cls.class_id, rows[0].student_id]);
    });
    res.json({ success: true });
  });
  router.delete("/:id/members/:memberId", async (req, res) => {
    if (!validId(req.params.memberId)) throw missing();
    await transaction(async (db) => {
      const cls = await classRow(db, req, true); await noActiveQuiz(db, cls.class_id);
      const result = await db.query("UPDATE class_memberships SET status='REMOVED' WHERE membership_id=$1 AND class_id=$2 AND status='ACTIVE'", [req.params.memberId, cls.class_id]);
      if (!result.rowCount) throw missing();
    }); res.json({ success: true });
  });
  router.post("/:id/leave", async (req, res) => {
    role(req, "STUDENT");
    await transaction(async (db) => {
      const cls = await classRow(db, req); await noActiveQuiz(db, cls.class_id);
      const result = await db.query("UPDATE class_memberships SET status='LEFT' WHERE class_id=$1 AND student_id=$2 AND status='ACTIVE'", [cls.class_id, req.user.userId]);
      if (!result.rowCount) throw missing();
    }); res.json({ success: true });
  });
  router.post("/:id/materials", async (req, res) => {
    const ids = req.body?.documentIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every(validId) || req.body?.contentIds !== undefined) throw httpError(400, "Chỉ chia sẻ 1–50 tài liệu PDF, DOCX hoặc TXT. Flashcard và Mindmap dùng cá nhân.");
    await transaction(async (db) => {
      const cls = await classRow(db, req, true);
      const unique = [...new Set(ids.map(String))];
      const docs = await db.query("SELECT document_id FROM source_documents WHERE document_id=ANY($1::bigint[]) AND owner_id=$2 AND status IN ('READY','FAILED') FOR UPDATE", [unique, req.user.userId]);
      if (docs.rowCount !== unique.length) throw httpError(400, "Chỉ chia sẻ tài liệu của bạn đã được xử lý và chưa xóa.");
      for (const id of unique) await db.query("INSERT INTO class_materials(class_id,document_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [cls.class_id, id]);
    }); res.json({ success: true });
  });
  router.delete("/:id/materials/:documentId", async (req, res) => {
    if (!validId(req.params.documentId)) throw missing();
    await transaction(async (db) => {
      const cls = await classRow(db, req, true);
      await db.query("DELETE FROM class_materials WHERE class_id=$1 AND document_id=$2", [cls.class_id, req.params.documentId]);
    }); res.json({ success: true });
  });
  router.delete("/:id", async (req, res) => {
    await transaction(async (db) => {
      const cls = await classRow(db, req, true); await noActiveQuiz(db, cls.class_id);
      await db.query("UPDATE classrooms SET status='DELETED' WHERE class_id=$1", [cls.class_id]);
      await db.query("UPDATE join_requests SET status='REJECTED' WHERE class_id=$1 AND status='PENDING'", [cls.class_id]);
      await db.query("UPDATE class_memberships SET status='REMOVED' WHERE class_id=$1", [cls.class_id]);
      await db.query("DELETE FROM class_materials WHERE class_id=$1", [cls.class_id]);
    }); res.json({ success: true });
  });
  return router;
}
