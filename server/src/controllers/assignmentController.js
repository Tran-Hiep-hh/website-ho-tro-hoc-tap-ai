import { pool } from "../config/database.js";
import { createAssignmentRepository } from "../repositories/assignmentRepository.js";
import { createAssignmentService } from "../services/assignmentService.js";
import { httpError } from "../utils/httpError.js";
import { notifyClass } from "../services/notificationService.js";
import { validateQuestions } from "../validators/quizValidator.js";
import { validateCreateAssignment, validateUpdateAssignment, validId } from "../validators/assignmentValidator.js";

const missing = () => httpError(404, "Không tìm thấy bài giao hoặc bạn không có quyền truy cập.");
const safeQuestions = (items) => items.map(({ answer, explanation, source, optionIds, ...q }) => q);
const attemptDeadline = (assignment, attempt) => new Date(Math.min(
  new Date(assignment.due_at).getTime(),
  assignment.duration_minutes == null ? Infinity : new Date(attempt.started_at).getTime() + assignment.duration_minutes * 60000,
));
async function answers(repository, row, items, executor) {
  const rows = await repository.findAnswers(row.attempt_id, executor);
  return items.map((q) => q.optionIds.indexOf(String(rows.find((r) => String(r.question_id) === q.id)?.selected_option_id)));
}

export function createAssignmentController({ database = pool, assignmentRepository = createAssignmentRepository(database), assignmentService = createAssignmentService(assignmentRepository, database) } = {}) {
  const handlers = {};
  async function finish(db, row, items, at) {
    const selected = await answers(assignmentRepository, row, items, db);
    const score = Math.round(items.filter((q, i) => q.answer === selected[i]).length / items.length * 10000) / 100;
    const { rows } = await assignmentRepository.finishAttempt(row.attempt_id, score, at, db);
    return rows[0];
  }
  async function result(db, row, assignment, user, reveal) {
    const items = await assignmentRepository.findQuestions(row.quiz_version_id, db), selected = await answers(assignmentRepository, row, items, db);
    return { id: String(row.attempt_id), attemptNumber: row.attempt_number, persisted: true, assignmentId: String(row.assignment_id), classId: assignment.class_id == null ? null : String(assignment.class_id), className: assignment.class_name ?? null, contentId: String(assignment.quiz_id), title: assignment.title, userId: String(row.user_id), name: user.full_name, email: user.email, status: row.status, date: row.submitted_at, score: Number(row.score), correctCount: items.filter((q, i) => q.answer === selected[i]).length, showAnswers: reveal, answers: selected, questions: reveal ? items : safeQuestions(items) };
  }
  // Deadline finalization uses only answers saved before the deadline, even after the browser closes.
  async function expire(id) {
    await assignmentService.runInTransaction(async (db) => {
      const { rows } = await assignmentRepository.findForExpiry(id, db);
      const item = rows[0];
      if (!item || item.status !== "PUBLISHED" || item.deleted_at) return;
      const attempts = await assignmentRepository.findInProgress(id, db);
      if (!attempts.rowCount) return;
      const all = await assignmentRepository.findQuestions(item.quiz_version_id, db);
      for (const attempt of attempts.rows) {
        const deadline = attemptDeadline(item, attempt);
        if (deadline.getTime() <= Date.now()) await finish(db, attempt, all, deadline);
      }
    });
  }
  handlers.list = async (req, res) => {
    const visible = await assignmentRepository.listVisible(req.user.userId, database);
    const history = await assignmentRepository.listHistory(req.user.userId, database);
    for (const id of new Set([...visible.rows.map((a) => a.assignment_id), ...history.rows.map((a) => a.assignment_id)])) await expire(id);
    const assignments = [];
    for (const a of visible.rows) {
      const all = await assignmentRepository.findQuestions(a.quiz_version_id, database);
      const counts = await assignmentRepository.countAttempts(a.assignment_id, req.user.userId, database);
      assignments.push({ id: String(a.assignment_id), persisted: true, classId: String(a.class_id), contentId: String(a.quiz_id), versionId: String(a.quiz_version_id), title: a.title, startAt: a.start_at, dueAt: a.due_at, maxAttempts: a.max_attempts, durationMinutes: a.duration_minutes, showAnswers: a.show_answers, status: a.status, questionCount: all.length, questions: req.user.role === "TEACHER" ? all : [], attemptsUsed: counts.rows[0].used, inProgress: Boolean(counts.rows[0].ongoing) });
    }
    const { rows } = await assignmentRepository.listSubmitted(req.user.userId, database);
    const attempts = [], classAttempts = [];
    for (const row of rows) {
      const ownClass = String(row.teacher_id) === String(req.user.userId);
      const item = await result(database, row, row, row, ownClass || row.show_answers);
      if (String(row.user_id) === String(req.user.userId)) attempts.push(item);
      if (ownClass) classAttempts.push(item);
    }
    res.json({ success: true, assignments, attempts, classAttempts });
  };
  handlers.create = async (req, res) => {
    if (req.user.role !== "TEACHER") throw httpError(403, "Chỉ giáo viên được giao Quiz.");
    const b = req.body ?? {}, schedule = validateCreateAssignment(b);
    const id = await assignmentService.runInTransaction(async (db) => {
      await assignmentService.classAccess(db, req.user, b.classId, true);
      const quiz = await assignmentRepository.findReadyQuiz(b.contentId, req.user.userId, db);
      if (!quiz.rowCount) throw missing();
      const versions = await assignmentRepository.findPublicVersion(b.contentId, db);
      if (String(versions.rows[0]?.quiz_version_id) !== String(b.versionId)) throw httpError(409, "Quiz đã thay đổi. Tải lại học liệu trước khi giao bài.");
      const items = await assignmentRepository.findQuestions(b.versionId, db);
      if (!items.length || items.some((q) => q.options.length !== 4 || q.answer < 0)) throw httpError(400, "Quiz chưa có câu hỏi hợp lệ.");
      const { rows } = await assignmentRepository.createAssignment([b.classId, b.versionId, schedule.title, schedule.start, schedule.due, b.maxAttempts, b.showAnswers, b.status, schedule.duration], db);
      if (b.status === "PUBLISHED") await notifyClass(db, b.classId, "Quiz mới được giao", schedule.title, `assignments/${rows[0].assignment_id}`, "quiz");
      return String(rows[0].assignment_id);
    }); res.status(201).json({ success: true, id });
  };
  handlers.update = async (req, res) => {
    const b = req.body ?? {}, schedule = validateUpdateAssignment(b);
    const items = validateQuestions(b.questions);
    await assignmentService.runInTransaction(async (db) => {
      const a = await assignmentService.access(db, req.user, req.params.id, true);
      if (a.deleted_at) throw missing();
      if (a.status !== "DRAFT") throw httpError(409, "Chỉ được chỉnh sửa bản nháp chưa công bố.");
      if (String(a.quiz_version_id) !== String(b.versionId)) throw httpError(409, "Bản nháp đã thay đổi. Tải lại trang trước khi sửa.");
      const original = await assignmentRepository.findOriginalContent(a.quiz_version_id, db);
      const version = await assignmentRepository.createAssignmentVersion(original.rows[0].content_id, schedule.title, db);
      const versionId = version.rows[0].quiz_version_id;
      for (const [index, q] of items.entries()) {
        const inserted = await assignmentRepository.createQuestion(versionId, q, index + 1, db);
        for (const [i, option] of q.options.entries()) await assignmentRepository.createOption(inserted.rows[0].question_id, option, q.answer === i, i + 1, db);
      }
      await assignmentRepository.updateAssignment([a.assignment_id, schedule.title, versionId, schedule.start, schedule.due, b.maxAttempts, schedule.duration, b.showAnswers], db);
    });
    res.json({ success: true });
  };
  handlers.remove = async (req, res) => {
    await assignmentService.runInTransaction(async (db) => {
      const a = await assignmentService.access(db, req.user, req.params.id, true);
      await assignmentRepository.deleteAssignmentAttempts(a.assignment_id, db);
      await assignmentRepository.cancelAssignment(a.assignment_id, db);
    });
    res.json({ success: true });
  };
  handlers.changeStatus = async (req, res) => {
    await assignmentService.runInTransaction(async (db) => {
      const a = await assignmentService.access(db, req.user, req.params.id, true), next = req.body?.status;
      if (a.deleted_at) throw missing();
      if (next === "PUBLISHED" && a.status === "DRAFT" && new Date(a.due_at).getTime() > Date.now()) {
        await assignmentRepository.publish(a.assignment_id, db);
        await notifyClass(db, a.class_id, "Quiz mới được giao", a.title, `assignments/${a.assignment_id}`, "quiz");
      } else if (next === "CANCELLED") {
        await assignmentRepository.cancelAssignment(a.assignment_id, db);
      } else throw httpError(409, "Không thể đổi trạng thái. Chỉ công bố bài nháp chưa hết hạn.");
    }); res.json({ success: true });
  };
  handlers.startAttempt = async (req, res) => {
    const attempt = await assignmentService.runInTransaction(async (db) => {
      const a = await assignmentService.access(db, req.user, req.params.id);
      const now = Date.now();
      if (a.status !== "PUBLISHED" || now < new Date(a.start_at).getTime() || now >= new Date(a.due_at).getTime()) throw httpError(409, "Bài giao chưa mở, đã hết hạn hoặc đã hủy.");
      let { rows } = await assignmentRepository.findAttempts(a.assignment_id, req.user.userId, db);
      let row = rows.find((r) => r.status === "IN_PROGRESS");
      if (row && attemptDeadline(a, row).getTime() <= now) {
        const items = await assignmentRepository.findQuestions(a.quiz_version_id, db);
        row = await finish(db, row, items, attemptDeadline(a, row));
        const version = await assignmentRepository.findQuizIdByVersion(a.quiz_version_id, db);
        return { submitted: true, result: await result(db, row, { ...a, quiz_id: version.rows[0].quiz_id }, { full_name: req.user.fullName }, a.show_answers) };
      }
      if (!row) {
        if (rows.length >= a.max_attempts) throw httpError(409, "Bạn đã dùng hết lượt làm bài.");
        const inserted = await assignmentRepository.createAssignedAttempt(req.user.userId, a.quiz_version_id, a.assignment_id, rows.length + 1, db);
        row = inserted.rows[0];
      }
      const items = await assignmentRepository.findQuestions(a.quiz_version_id, db);
      return { id: String(row.attempt_id), title: a.title, questions: safeQuestions(items), answers: await answers(assignmentRepository, row, items, db), revision: row.answer_revision, dueAt: attemptDeadline(a, row), startedAt: row.started_at, serverNow: new Date().toISOString() };
    }); res.json({ success: true, attempt });
  };
  async function writeAttempt(req, submit) {
    return assignmentService.runInTransaction(async (db) => {
      if (!validId(req.params.id)) throw missing();
      const found = await assignmentRepository.findAttemptAssignment(req.params.id, req.user.userId, db);
      if (!found.rowCount) throw missing();
      const a = await assignmentService.access(db, req.user, found.rows[0].assignment_id);
      const { rows } = await assignmentRepository.findAttemptForUpdate(req.params.id, db);
      let row = rows[0];
      if (!row) throw missing();
      const items = await assignmentRepository.findQuestions(row.quiz_version_id, db);
      const version = await assignmentRepository.findQuizIdByVersion(a.quiz_version_id, db); a.quiz_id = version.rows[0].quiz_id;
      const user = { full_name: req.user.fullName };
      if (row.status === "SUBMITTED") return { submitted: true, attempt: await result(db, row, a, user, a.show_answers) };
      if (a.status !== "PUBLISHED" || a.deleted_at) throw httpError(409, "Giáo viên đã hủy hoặc xóa bài giao. Bạn không thể tiếp tục làm bài.");
      const now = Date.now();
      if (now >= attemptDeadline(a, row).getTime()) {
        row = await finish(db, row, items, attemptDeadline(a, row));
        return { submitted: true, attempt: await result(db, row, a, user, a.show_answers) };
      }
      if (a.status !== "PUBLISHED" || now < new Date(a.start_at).getTime()) throw httpError(409, "Bài giao không còn mở.");
      if (req.body?.revision !== row.answer_revision) throw httpError(409, "Bài làm đã thay đổi ở tab khác. Tải lại trang để tiếp tục.");
      const selected = req.body?.answers;
      if (!Array.isArray(selected) || selected.length !== items.length || !selected.every((v) => Number.isInteger(v) && v >= -1 && v <= 3)) throw httpError(400, "Câu trả lời không hợp lệ.");
      for (const [i, q] of items.entries()) await assignmentRepository.saveAnswer(row.attempt_id, q.id, selected[i] === -1 ? null : q.optionIds[selected[i]], db);
      await assignmentRepository.incrementRevision(row.attempt_id, db);
      if (!submit) return { submitted: false, revision: row.answer_revision + 1 };
      row = await finish(db, row, items, new Date());
      return { submitted: true, attempt: await result(db, row, a, user, a.show_answers) };
    });
  }
  handlers.saveAnswers = async (req, res) => res.json({ success: true, ...await writeAttempt(req, false) });
  handlers.submitAttempt = async (req, res) => res.json({ success: true, ...await writeAttempt(req, true) });
  return handlers;
}
