import { Router } from "express";
import { pool } from "../config/database.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";
import { notifyClass } from "../services/notificationService.js";

const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;
const missing = () => httpError(404, "Không tìm thấy bài giao hoặc bạn không có quyền truy cập.");
const safeQuestions = (items) => items.map(({ answer, explanation, source, optionIds, ...q }) => q);
async function questions(db, version) {
  const { rows } = await db.query("SELECT q.*,json_agg(json_build_object('id',o.option_id::text,'text',o.option_text,'correct',o.is_correct) ORDER BY o.display_order) AS options FROM quiz_questions q JOIN answer_options o USING(question_id) WHERE quiz_version_id=$1 GROUP BY q.question_id ORDER BY q.display_order", [version]);
  return rows.map((q) => ({ id: String(q.question_id), text: q.question_text, options: q.options.map((o) => o.text), optionIds: q.options.map((o) => o.id), answer: q.options.findIndex((o) => o.correct), explanation: q.explanation, source: q.source_label ?? "" }));
}
async function answers(db, row, items) {
  const { rows } = await db.query("SELECT question_id,selected_option_id FROM attempt_answers WHERE attempt_id=$1", [row.attempt_id]);
  return items.map((q) => q.optionIds.indexOf(String(rows.find((r) => String(r.question_id) === q.id)?.selected_option_id)));
}

export function createAssignmentRouter({ database = pool, authRepository = createAuthRepository() } = {}) {
  const router = Router();
  router.use(requireAuth(createAuthService(authRepository)));
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : protectAuthMutation(req, res, next));
  async function transaction(fn) {
    const db = await database.connect();
    try { await db.query("BEGIN"); const result = await fn(db); await db.query("COMMIT"); return result; }
    catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
  }
  function teacher(req) { if (req.user.role !== "TEACHER") throw httpError(403, "Chỉ giáo viên được giao Quiz."); }
  async function classAccess(db, req, classId, own = false) {
    if (!validId(classId)) throw missing();
    const { rows } = await db.query("SELECT * FROM classrooms WHERE class_id=$1 AND status='ACTIVE' FOR UPDATE", [classId]);
    const cls = rows[0]; if (!cls) throw missing();
    if (own) { teacher(req); if (String(cls.teacher_id) !== String(req.user.userId)) throw missing(); }
    else {
      if (req.user.role !== "STUDENT") throw httpError(403, "Chỉ học sinh được làm bài giao.");
      const member = await db.query("SELECT 1 FROM class_memberships WHERE class_id=$1 AND student_id=$2 AND status='ACTIVE'", [classId, req.user.userId]);
      if (!member.rowCount) throw missing();
    }
    return cls;
  }
  async function access(db, req, id, own = false) {
    if (!validId(id)) throw missing();
    const lookup = await db.query("SELECT class_id FROM quiz_assignments WHERE assignment_id=$1", [id]);
    if (!lookup.rowCount) throw missing();
    await classAccess(db, req, lookup.rows[0].class_id, own);
    const { rows } = await db.query("SELECT * FROM quiz_assignments WHERE assignment_id=$1 FOR UPDATE", [id]);
    return rows[0];
  }
  async function finish(db, row, items, at) {
    const selected = await answers(db, row, items);
    const score = Math.round(items.filter((q, i) => q.answer === selected[i]).length / items.length * 10000) / 100;
    const { rows } = await db.query("UPDATE quiz_attempts SET status='SUBMITTED',score=$2,submitted_at=$3 WHERE attempt_id=$1 RETURNING *", [row.attempt_id, score, at]);
    return rows[0];
  }
  async function result(db, row, assignment, user, reveal) {
    const items = await questions(db, row.quiz_version_id), selected = await answers(db, row, items);
    return { id: String(row.attempt_id), persisted: true, assignmentId: String(row.assignment_id), contentId: String(assignment.quiz_id), title: assignment.title, userId: String(row.user_id), name: user.full_name, email: user.email, status: row.status, date: row.submitted_at, score: Number(row.score), correctCount: items.filter((q, i) => q.answer === selected[i]).length, showAnswers: reveal, answers: selected, questions: reveal ? items : safeQuestions(items) };
  }
  // Deadline finalization uses only answers saved before the deadline, even after the browser closes.
  async function expire(id) {
    await transaction(async (db) => {
      const { rows } = await db.query("SELECT * FROM quiz_assignments WHERE assignment_id=$1 FOR UPDATE", [id]);
      const item = rows[0];
      if (!item || new Date(item.due_at).getTime() > Date.now()) return;
      const attempts = await db.query("SELECT * FROM quiz_attempts WHERE assignment_id=$1 AND status='IN_PROGRESS' FOR UPDATE", [id]);
      if (!attempts.rowCount) return;
      const all = await questions(db, item.quiz_version_id);
      for (const attempt of attempts.rows) await finish(db, attempt, all, item.due_at);
    });
  }
  router.get("/", async (req, res) => {
    const visible = await database.query("SELECT a.*,v.quiz_id FROM quiz_assignments a JOIN quiz_versions v USING(quiz_version_id) JOIN classrooms c USING(class_id) WHERE c.teacher_id=$1 OR (c.status='ACTIVE' AND a.status='PUBLISHED' AND EXISTS(SELECT 1 FROM class_memberships m WHERE m.class_id=c.class_id AND m.student_id=$1 AND m.status='ACTIVE')) ORDER BY a.assignment_id", [req.user.userId]);
    const history = await database.query("SELECT DISTINCT assignment_id FROM quiz_attempts WHERE user_id=$1 AND assignment_id IS NOT NULL", [req.user.userId]);
    for (const id of new Set([...visible.rows.map((a) => a.assignment_id), ...history.rows.map((a) => a.assignment_id)])) await expire(id);
    const assignments = [];
    for (const a of visible.rows) {
      const all = await questions(database, a.quiz_version_id);
      const counts = await database.query("SELECT COUNT(*)::integer AS used,BOOL_OR(status='IN_PROGRESS') AS ongoing FROM quiz_attempts WHERE assignment_id=$1 AND user_id=$2", [a.assignment_id, req.user.userId]);
      assignments.push({ id: String(a.assignment_id), persisted: true, classId: String(a.class_id), contentId: String(a.quiz_id), versionId: String(a.quiz_version_id), title: a.title, startAt: a.start_at, dueAt: a.due_at, maxAttempts: a.max_attempts, showAnswers: a.show_answers, status: a.status, questionCount: all.length, questions: req.user.role === "TEACHER" ? all : [], attemptsUsed: counts.rows[0].used, inProgress: Boolean(counts.rows[0].ongoing) });
    }
    const { rows } = await database.query("SELECT t.*,a.title,a.show_answers,v.quiz_id,c.teacher_id,u.full_name,u.email FROM quiz_attempts t JOIN quiz_assignments a USING(assignment_id) JOIN quiz_versions v ON v.quiz_version_id=t.quiz_version_id JOIN classrooms c ON c.class_id=a.class_id JOIN users u ON u.user_id=t.user_id WHERE t.status='SUBMITTED' AND (t.user_id=$1 OR c.teacher_id=$1) ORDER BY t.submitted_at", [req.user.userId]);
    const attempts = [], classAttempts = [];
    for (const row of rows) {
      const ownClass = String(row.teacher_id) === String(req.user.userId);
      const item = await result(database, row, row, row, ownClass || row.show_answers);
      if (String(row.user_id) === String(req.user.userId)) attempts.push(item);
      if (ownClass) classAttempts.push(item);
    }
    res.json({ success: true, assignments, attempts, classAttempts });
  });
  router.post("/", async (req, res) => {
    teacher(req);
    const b = req.body ?? {}, start = new Date(b.startAt), due = new Date(b.dueAt);
    if (typeof b.title !== "string" || !b.title.trim() || b.title.length > 150 || b.title.includes("\0") || !validId(b.contentId) || !validId(b.versionId) || !Number.isFinite(start.getTime()) || !Number.isFinite(due.getTime()) || due <= start || due.getTime() <= Date.now() || !Number.isInteger(b.maxAttempts) || b.maxAttempts < 1 || b.maxAttempts > 10 || typeof b.showAnswers !== "boolean" || !["DRAFT", "PUBLISHED"].includes(b.status)) throw httpError(400, "Thiết lập bài giao không hợp lệ. Kiểm tra tên, lịch và số lượt 1–10.");
    const id = await transaction(async (db) => {
      await classAccess(db, req, b.classId, true);
      const quiz = await db.query("SELECT content_id FROM generated_contents WHERE content_id=$1 AND owner_id=$2 AND content_type='QUIZ' AND status='READY' FOR UPDATE", [b.contentId, req.user.userId]);
      if (!quiz.rowCount) throw missing();
      const versions = await db.query("SELECT quiz_version_id FROM quiz_versions WHERE quiz_id=$1 ORDER BY version_number DESC LIMIT 1", [b.contentId]);
      if (String(versions.rows[0]?.quiz_version_id) !== String(b.versionId)) throw httpError(409, "Quiz đã thay đổi. Tải lại học liệu trước khi giao bài.");
      const items = await questions(db, b.versionId);
      if (!items.length || items.some((q) => q.options.length !== 4 || q.answer < 0)) throw httpError(400, "Quiz chưa có câu hỏi hợp lệ.");
      const { rows } = await db.query("INSERT INTO quiz_assignments(class_id,quiz_version_id,title,start_at,due_at,max_attempts,show_answers,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING assignment_id", [b.classId, b.versionId, b.title.trim(), start, due, b.maxAttempts, b.showAnswers, b.status]);
      if (b.status === "PUBLISHED") await notifyClass(db, b.classId, "Quiz mới được giao", b.title.trim(), `assignments/${rows[0].assignment_id}`, "quiz");
      return String(rows[0].assignment_id);
    }); res.status(201).json({ success: true, id });
  });
  router.post("/:id/status", async (req, res) => {
    await transaction(async (db) => {
      const a = await access(db, req, req.params.id, true), next = req.body?.status;
      if (next === "PUBLISHED" && a.status === "DRAFT" && new Date(a.due_at).getTime() > Date.now()) {
        await db.query("UPDATE quiz_assignments SET status='PUBLISHED' WHERE assignment_id=$1", [a.assignment_id]);
        await notifyClass(db, a.class_id, "Quiz mới được giao", a.title, `assignments/${a.assignment_id}`, "quiz");
      } else if (next === "CANCELLED" && (a.status === "DRAFT" || (a.status === "PUBLISHED" && new Date(a.start_at).getTime() > Date.now()))) {
        await db.query("UPDATE quiz_assignments SET status='CANCELLED' WHERE assignment_id=$1", [a.assignment_id]);
      } else throw httpError(409, "Không thể đổi trạng thái. Chỉ hủy bài nháp hoặc bài chưa mở; không công bố bài đã hết hạn.");
    }); res.json({ success: true });
  });
  router.post("/:id/attempts", async (req, res) => {
    const attempt = await transaction(async (db) => {
      const a = await access(db, req, req.params.id);
      const now = Date.now();
      if (a.status !== "PUBLISHED" || now < new Date(a.start_at).getTime() || now >= new Date(a.due_at).getTime()) throw httpError(409, "Bài giao chưa mở, đã hết hạn hoặc đã hủy.");
      let { rows } = await db.query("SELECT * FROM quiz_attempts WHERE assignment_id=$1 AND user_id=$2 ORDER BY attempt_number DESC", [a.assignment_id, req.user.userId]);
      let row = rows.find((r) => r.status === "IN_PROGRESS");
      if (!row) {
        if (rows.length >= a.max_attempts) throw httpError(409, "Bạn đã dùng hết lượt làm bài.");
        const inserted = await db.query("INSERT INTO quiz_attempts(user_id,quiz_version_id,assignment_id,attempt_number,started_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *", [req.user.userId, a.quiz_version_id, a.assignment_id, rows.length + 1]);
        row = inserted.rows[0];
      }
      const items = await questions(db, a.quiz_version_id);
      return { id: String(row.attempt_id), title: a.title, questions: safeQuestions(items), answers: await answers(db, row, items), revision: row.answer_revision, dueAt: a.due_at, serverNow: new Date().toISOString() };
    }); res.json({ success: true, attempt });
  });
  async function writeAttempt(req, submit) {
    return transaction(async (db) => {
      if (!validId(req.params.id)) throw missing();
      const found = await db.query("SELECT assignment_id FROM quiz_attempts WHERE attempt_id=$1 AND user_id=$2 AND assignment_id IS NOT NULL", [req.params.id, req.user.userId]);
      if (!found.rowCount) throw missing();
      const a = await access(db, req, found.rows[0].assignment_id);
      const { rows } = await db.query("SELECT * FROM quiz_attempts WHERE attempt_id=$1 FOR UPDATE", [req.params.id]);
      let row = rows[0];
      const items = await questions(db, row.quiz_version_id);
      const version = await db.query("SELECT quiz_id FROM quiz_versions WHERE quiz_version_id=$1", [a.quiz_version_id]); a.quiz_id = version.rows[0].quiz_id;
      const user = { full_name: req.user.fullName };
      if (row.status === "SUBMITTED") return { submitted: true, attempt: await result(db, row, a, user, a.show_answers) };
      const now = Date.now();
      if (now >= new Date(a.due_at).getTime()) {
        row = await finish(db, row, items, a.due_at);
        return { submitted: true, attempt: await result(db, row, a, user, a.show_answers) };
      }
      if (a.status !== "PUBLISHED" || now < new Date(a.start_at).getTime()) throw httpError(409, "Bài giao không còn mở.");
      if (req.body?.revision !== row.answer_revision) throw httpError(409, "Bài làm đã thay đổi ở tab khác. Tải lại trang để tiếp tục.");
      const selected = req.body?.answers;
      if (!Array.isArray(selected) || selected.length !== items.length || !selected.every((v) => Number.isInteger(v) && v >= -1 && v <= 3)) throw httpError(400, "Câu trả lời không hợp lệ.");
      for (const [i, q] of items.entries()) await db.query("INSERT INTO attempt_answers(attempt_id,question_id,selected_option_id) VALUES ($1,$2,$3) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_id=EXCLUDED.selected_option_id", [row.attempt_id, q.id, selected[i] === -1 ? null : q.optionIds[selected[i]]]);
      await db.query("UPDATE quiz_attempts SET answer_revision=answer_revision+1 WHERE attempt_id=$1", [row.attempt_id]);
      if (!submit) return { submitted: false, revision: row.answer_revision + 1 };
      row = await finish(db, row, items, new Date());
      return { submitted: true, attempt: await result(db, row, a, user, a.show_answers) };
    });
  }
  router.put("/attempts/:id/answers", async (req, res) => res.json({ success: true, ...await writeAttempt(req, false) }));
  router.post("/attempts/:id/submit", async (req, res) => res.json({ success: true, ...await writeAttempt(req, true) }));
  return router;
}
