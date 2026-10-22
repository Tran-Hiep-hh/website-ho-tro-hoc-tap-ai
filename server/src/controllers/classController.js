import { pool } from "../config/database.js";
import { createClassRepository } from "../repositories/classRepository.js";
import { createClassService } from "../services/classService.js";
import { httpError } from "../utils/httpError.js";
import { notifyUser, notifyClass } from "../services/notificationService.js";

const validId = (id) => /^[1-9]\d{0,18}$/.test(String(id)) && BigInt(id) <= 9223372036854775807n;
const missing = () => httpError(404, "Lớp không tồn tại hoặc bạn không có quyền truy cập.");
function text(value, max, required = true) {
  if (typeof value !== "string" || value.includes("\0") || value.length > max || (required && !value.trim())) throw httpError(400, "Thông tin lớp trống hoặc vượt độ dài cho phép.");
  return value.trim();
}
function role(req, expected) {
  if (req.user.role !== expected) throw httpError(403, expected === "TEACHER" ? "Chỉ giáo viên được quản lý lớp học." : "Chỉ học sinh được gửi yêu cầu tham gia hoặc rời lớp.");
}
const basic = (row) => ({ id: String(row.class_id), persisted: true, name: row.class_name, group: row.group_name, description: row.description ?? "", code: row.join_code, teacher: row.teacher, teacherId: String(row.teacher_id), color: "green", materialIds: [], joined: false, pending: false });

export function createClassController({ database = pool, classService = createClassService(createClassRepository(database), database) } = {}) {
  const handlers = {};
  handlers.list = async (req, res) => {
    const result = await classService.runInTransaction(async (db) => {
      const data = await classService.visible(db, req.user.userId);
      const owned = data.classes.filter((row) => String(row.teacher_id) === String(req.user.userId)).map((row) => row.class_id);
      const docs = [...new Map(data.links.map((row) => [String(row.document_id), { id: String(row.document_id), ownerId: String(row.owner_id), name: row.file_name, type: row.file_type, size: `${(Number(row.file_size) / 1024).toFixed(1)} KB`, date: row.created_at, status: row.status, text: row.extracted_text ?? "" }])).values()];
      return { classes: data.classes.map((row) => ({ ...basic(row), pendingRequestId: row.pendingRequestId === null ? null : String(row.pendingRequestId), joined: row.joined || owned.includes(row.class_id), pending: row.pending && !row.joined, materialIds: data.links.filter((link) => link.class_id === row.class_id).map((link) => String(link.document_id)) })), members: data.members.map((row) => ({ id: String(row.membership_id), userId: String(row.student_id), classId: String(row.class_id), name: row.full_name, email: row.email })), requests: data.requests.map((row) => ({ id: String(row.request_id), userId: String(row.student_id), classId: String(row.class_id), name: row.full_name, email: row.email })), documents: docs };
    });
    res.json({ success: true, ...result });
  };
  handlers.lookup = async (req, res) => {
    role(req, "STUDENT");
    res.json({ success: true, classroom: basic(await classService.lookup(req.body?.code)) });
  };
  handlers.create = async (req, res) => {
    role(req, "TEACHER");
    res.status(201).json({ success: true, id: await classService.create(req.user.userId, req.body) });
  };
  handlers.update = async (req, res) => {
    const input = classService.validateFields(req.body);
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id, true);
      await classService.update(db, cls.class_id, input);
    });
    res.json({ success: true });
  };
  handlers.join = async (req, res) => {
    role(req, "STUDENT");
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id);
      if (text(req.body?.code, 20).toUpperCase() !== cls.join_code) throw missing();
      await classService.requestJoin(db, cls, req.user.userId);
      await notifyUser(db, cls.teacher_id, "Yêu cầu tham gia lớp mới", `${req.user.fullName} muốn tham gia lớp ${cls.class_name}.`, `classes/${cls.class_id}/requests`);
    });
    res.status(201).json({ success: true });
  };
  handlers.cancelRequest = async (req, res) => {
    role(req, "STUDENT");
    if (!validId(req.params.requestId)) throw missing();
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id);
      // Use the same class lock as approval; cancel only this user's exact pending request.
      await classService.cancelRequest(db, req.params.requestId, cls.class_id, req.user.userId);
    });
    res.json({ success: true });
  };
  handlers.decideRequest = async (req, res) => {
    if (!validId(req.params.requestId) || typeof req.body?.approve !== "boolean") throw httpError(400, "Yêu cầu duyệt không hợp lệ.");
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id, true);
      const request = await classService.decideRequest(db, req.params.requestId, cls.class_id, req.body.approve);
      await notifyUser(db, request.student_id, req.body.approve ? "Yêu cầu tham gia được duyệt" : "Yêu cầu tham gia bị từ chối", `Giáo viên đã ${req.body.approve ? "duyệt" : "từ chối"} yêu cầu vào lớp ${cls.class_name}.`, req.body.approve ? `classes/${cls.class_id}` : "classes");
    });
    res.json({ success: true });
  };
  handlers.removeMember = async (req, res) => {
    if (!validId(req.params.memberId)) throw missing();
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id, true); await classService.ensureNoActiveQuiz(db, cls.class_id);
      const result = await classService.removeMember(db, req.params.memberId, cls.class_id);
      if (!result.rowCount) throw missing();
    }); res.json({ success: true });
  };
  handlers.leave = async (req, res) => {
    role(req, "STUDENT");
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id); await classService.ensureNoActiveQuiz(db, cls.class_id);
      const result = await classService.leave(db, cls.class_id, req.user.userId);
      if (!result.rowCount) throw missing();
    }); res.json({ success: true });
  };
  handlers.shareMaterials = async (req, res) => {
    const ids = req.body?.documentIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every(validId) || req.body?.contentIds !== undefined) throw httpError(400, "Chỉ chia sẻ 1–50 tài liệu PDF, DOCX hoặc TXT. Flashcard và Mindmap dùng cá nhân.");
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id, true);
      const { added } = await classService.shareMaterials(db, cls.class_id, req.user.userId, ids);
      if (added) await notifyClass(db, cls.class_id, "Tài liệu mới trong lớp", `${cls.class_name}: giáo viên đã chia sẻ ${added} tài liệu mới.`, `classes/${cls.class_id}`, "file");
    }); res.json({ success: true });
  };
  handlers.unshareMaterial = async (req, res) => {
    if (!validId(req.params.documentId)) throw missing();
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id, true);
      await classService.unshareMaterial(db, cls.class_id, req.params.documentId);
    }); res.json({ success: true });
  };
  handlers.remove = async (req, res) => {
    await classService.runInTransaction(async (db) => {
      const cls = await classService.getOwnedClass(db, req.user, req.params.id, true);
      await classService.deleteClass(db, cls.class_id);
    }); res.json({ success: true });
  };
  return handlers;
}
