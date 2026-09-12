import { Router } from "express";
import { pool } from "../config/database.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation, authRateLimit } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";
import { generateQuiz } from "../services/quizGenerator.js";

const notFound = () => httpError(404, "Không tìm thấy Quiz hoặc lượt làm của bạn.");
const difficulties = { "Dễ": "EASY", "Trung bình": "MEDIUM", "Khó": "HARD" };
const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;
function text(value, max, required = true) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()) || value.includes("\0")) throw httpError(400, "Nội dung trống hoặc vượt độ dài cho phép.");
  return value.trim();
}
function settings(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "Thiết lập Quiz không hợp lệ.");
  const title = text(body.title, 150);
  if (!Object.hasOwn(difficulties, body.difficulty)) throw httpError(400, "Độ khó không hợp lệ.");
  if (!Array.isArray(body.sources) || !body.sources.length || body.sources.length > 10 || !body.sources.every(validId)) throw httpError(400, "Chọn từ 1 đến 10 tài liệu nguồn.");
  return { title, difficulty: body.difficulty, sources: [...new Set(body.sources.map(String))], contentRequest: text(body.contentRequest ?? "", 3000, false) };
}
function validateQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 50) throw httpError(400, "Quiz cần từ 1 đến 50 câu hỏi.");
  return questions.map((q) => {
    if (!q || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) throw httpError(400, "Mỗi câu cần 4 lựa chọn và 1 đáp án đúng.");
    const options = q.options.map((o) => text(o, 2000));
    if (new Set(options.map((o) => o.toLocaleLowerCase())).size !== 4) throw httpError(400, "Các lựa chọn trong một câu không được trùng nhau.");
    return { text: text(q.text, 4000), options, answer: q.answer, explanation: text(q.explanation, 4000), source: text(q.source ?? "Bổ sung thủ công", 1000, false) };
  });
}

export function createQuizRouter({ database = pool, authRepository = createAuthRepository() } = {}) {
  const router = Router();
  router.use(requireAuth(createAuthService(authRepository)));
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use((req, res, next) => req.method === "GET" || req.method === "HEAD" ? next() : protectAuthMutation(req, res, next));
  async function transaction(fn) {
    const db = await database.connect();
    try { await db.query("BEGIN"); const result = await fn(db); await db.query("COMMIT"); return result; }
    catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
  }
  async function sources(db, owner, ids) {
    const result = await db.query("SELECT document_id FROM source_documents WHERE document_id=ANY($1::bigint[]) AND owner_id=$2 AND status='READY' AND length(trim(extracted_text)) > 0 FOR SHARE", [ids, owner]);
    if (result.rowCount !== ids.length) throw httpError(400, "Tài liệu nguồn phải thuộc về bạn, còn tồn tại và có văn bản sẵn sàng.");
  }
  async function owned(db, owner, id, lock = false) {
    if (!validId(id)) throw notFound();
    const { rows } = await db.query(`SELECT * FROM generated_contents WHERE content_id=$1 AND owner_id=$2 AND content_type='QUIZ' AND status <> 'DELETED'${lock ? " FOR UPDATE" : ""}`, [id, owner]);
    if (!rows[0]) throw notFound(); return rows[0];
  }
  async function questions(db, versionId) {
    const { rows } = await db.query("SELECT q.*, json_agg(json_build_object('id',o.option_id::text,'text',o.option_text,'correct',o.is_correct) ORDER BY o.display_order) AS options FROM quiz_questions q JOIN answer_options o USING(question_id) WHERE quiz_version_id=$1 GROUP BY q.question_id ORDER BY q.display_order", [versionId]);
    return rows.map((q) => ({ id: String(q.question_id), text: q.question_text, options: q.options.map((o) => o.text), optionIds: q.options.map((o) => o.id), answer: q.options.findIndex((o) => o.correct), explanation: q.explanation, source: q.source_label ?? "" }));
  }
  async function content(db, row) {
    const { rows: versions } = await db.query("SELECT * FROM quiz_versions WHERE quiz_id=$1 ORDER BY version_number DESC LIMIT 1", [row.content_id]);
    const { rows: docs } = await db.query("SELECT document_id FROM content_sources WHERE content_id=$1 ORDER BY document_id", [row.content_id]);
    return { id: String(row.content_id), persisted: true, type: "QUIZ", title: row.title, status: row.status, difficulty: Object.keys(difficulties).find((key) => difficulties[key] === row.difficulty), createdAt: row.created_at, sources: docs.map((d) => String(d.document_id)), contentRequest: row.generation_settings.contentRequest ?? "", generationMode: row.generation_settings.mode ?? "MOCK", versionId: String(versions[0].quiz_version_id), questions: await questions(db, versions[0].quiz_version_id) };
  }
  async function writeVersion(db, quizId, title, items) {
    const { rows } = await db.query("INSERT INTO quiz_versions (quiz_id,version_number,title) SELECT $1,COALESCE(MAX(version_number),0)+1,$2 FROM quiz_versions WHERE quiz_id=$1 RETURNING quiz_version_id", [quizId, title]);
    for (const [index, q] of items.entries()) {
      const result = await db.query("INSERT INTO quiz_questions (quiz_version_id,question_text,explanation,source_label,display_order) VALUES ($1,$2,$3,$4,$5) RETURNING question_id", [rows[0].quiz_version_id, q.text, q.explanation, q.source, index + 1]);
      for (const [i, option] of q.options.entries()) await db.query("INSERT INTO answer_options (question_id,option_text,is_correct,display_order) VALUES ($1,$2,$3,$4)", [result.rows[0].question_id, option, q.answer === i, i + 1]);
    }
  }
  async function attempt(db, owner, id, lock = false) {
    if (!validId(id)) throw notFound();
    const { rows } = await db.query(`SELECT a.*, v.quiz_id, v.title FROM quiz_attempts a JOIN quiz_versions v USING(quiz_version_id) WHERE a.attempt_id=$1 AND a.user_id=$2 AND a.assignment_id IS NULL${lock ? " FOR UPDATE OF a" : ""}`, [id, owner]);
    if (!rows[0]) throw notFound(); return rows[0];
  }
  async function attemptResult(db, row, user) {
    const items = await questions(db, row.quiz_version_id);
    const { rows } = await db.query("SELECT question_id,selected_option_id FROM attempt_answers WHERE attempt_id=$1", [row.attempt_id]);
    const answers = items.map((q) => q.optionIds.indexOf(String(rows.find((r) => String(r.question_id) === q.id)?.selected_option_id)));
    return { id: String(row.attempt_id), persisted: true, contentId: String(row.quiz_id), assignmentId: null, title: row.title, userId: String(user.userId), name: user.fullName, status: row.status, date: row.submitted_at ?? row.started_at, score: row.score === null ? null : Number(row.score), showAnswers: true, answers, questions: items };
  }
  router.post("/generate", authRateLimit(30, 15 * 60_000), async (req, res) => {
    const input = settings(req.body);
    const quantity = Number(req.body.quantity ?? 5);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw httpError(400, "Chọn từ 1 đến 20 câu hỏi.");
    await sources(database, req.user.userId, input.sources);
    res.json({ success: true, content: await generateQuiz({ ...input, quantity }) });
  });
  router.get("/", async (req, res) => {
    const { rows } = await database.query("SELECT * FROM generated_contents WHERE owner_id=$1 AND content_type='QUIZ' AND status <> 'DELETED' ORDER BY created_at DESC", [req.user.userId]);
    res.json({ success: true, contents: await Promise.all(rows.map((row) => content(database, row))) });
  });
  router.get("/attempts", async (req, res) => {
    const { rows } = await database.query("SELECT a.*,v.quiz_id,v.title FROM quiz_attempts a JOIN quiz_versions v USING(quiz_version_id) WHERE a.user_id=$1 AND a.assignment_id IS NULL AND a.status='SUBMITTED' ORDER BY a.submitted_at", [req.user.userId]);
    res.json({ success: true, attempts: await Promise.all(rows.map((row) => attemptResult(database, row, req.user))) });
  });
  router.post("/", async (req, res) => {
    const input = settings(req.body), items = validateQuestions(req.body.questions);
    const result = await transaction(async (db) => {
      await sources(db, req.user.userId, input.sources);
      const { rows } = await db.query("INSERT INTO generated_contents (owner_id,content_type,title,difficulty,status,generation_settings) VALUES ($1,'QUIZ',$2,$3,'READY',$4) RETURNING *", [req.user.userId, input.title, difficulties[input.difficulty], { mode: "MOCK", contentRequest: input.contentRequest }]);
      for (const id of input.sources) await db.query("INSERT INTO content_sources (content_id,document_id) VALUES ($1,$2)", [rows[0].content_id, id]);
      await writeVersion(db, rows[0].content_id, input.title, items);
      return content(db, rows[0]);
    });
    res.status(201).json({ success: true, content: result });
  });
  router.put("/:id", async (req, res) => {
    const title = text(req.body.title, 150), items = validateQuestions(req.body.questions);
    const result = await transaction(async (db) => {
      const row = await owned(db, req.user.userId, req.params.id, true);
      const latest = await db.query("SELECT quiz_version_id FROM quiz_versions WHERE quiz_id=$1 ORDER BY version_number DESC LIMIT 1", [row.content_id]);
      if (String(req.body.versionId) !== String(latest.rows[0].quiz_version_id)) throw httpError(409, "Quiz đã được sửa ở nơi khác. Tải lại trang trước khi chỉnh sửa.");
      await db.query("UPDATE generated_contents SET title=$2 WHERE content_id=$1", [row.content_id, title]);
      await writeVersion(db, row.content_id, title, items);
      return content(db, { ...row, title });
    });
    res.json({ success: true, content: result });
  });
  router.delete("/:id", async (req, res) => {
    await transaction(async (db) => {
      const row = await owned(db, req.user.userId, req.params.id, true);
      const links = await db.query("SELECT 1 FROM class_materials WHERE content_id=$1 UNION ALL SELECT 1 FROM quiz_assignments a JOIN quiz_versions v USING(quiz_version_id) WHERE v.quiz_id=$1 AND a.status IN ('DRAFT','PUBLISHED')", [row.content_id]);
      if (links.rowCount) throw httpError(409, "Gỡ Quiz khỏi lớp và bài giao trước khi xóa.");
      await db.query("UPDATE generated_contents SET status='DELETED' WHERE content_id=$1", [row.content_id]);
    });
    res.json({ success: true });
  });
  router.post("/:id/attempts", async (req, res) => {
    const result = await transaction(async (db) => {
      const row = await owned(db, req.user.userId, req.params.id, true);
      const { rows: versions } = await db.query("SELECT quiz_version_id FROM quiz_versions WHERE quiz_id=$1 ORDER BY version_number DESC LIMIT 1", [row.content_id]);
      const version = versions[0].quiz_version_id;
      let { rows } = await db.query("SELECT * FROM quiz_attempts WHERE user_id=$1 AND quiz_version_id=$2 AND assignment_id IS NULL AND status='IN_PROGRESS' ORDER BY attempt_id DESC LIMIT 1", [req.user.userId, version]);
      if (!rows.length) ({ rows } = await db.query("INSERT INTO quiz_attempts (user_id,quiz_version_id,attempt_number,status,started_at) SELECT $1,$2,COALESCE(MAX(attempt_number),0)+1,'IN_PROGRESS',NOW() FROM quiz_attempts WHERE user_id=$1 AND quiz_version_id=$2 AND assignment_id IS NULL RETURNING *", [req.user.userId, version]));
      const all = await questions(db, version);
      return { id: String(rows[0].attempt_id), title: row.title, questions: all.map(({ answer, explanation, source, optionIds, ...q }) => q) };
    });
    res.json({ success: true, attempt: result });
  });
  router.post("/attempts/:id/submit", async (req, res) => {
    const result = await transaction(async (db) => {
      const row = await attempt(db, req.user.userId, req.params.id, true);
      if (row.status === "SUBMITTED") return attemptResult(db, row, req.user);
      const items = await questions(db, row.quiz_version_id), answers = req.body.answers;
      if (!Array.isArray(answers) || answers.length !== items.length || !answers.every((answer) => Number.isInteger(answer) && answer >= -1 && answer <= 3)) throw httpError(400, "Danh sách câu trả lời không hợp lệ.");
      for (const [index, q] of items.entries()) await db.query("INSERT INTO attempt_answers (attempt_id,question_id,selected_option_id) VALUES ($1,$2,$3)", [row.attempt_id, q.id, answers[index] === -1 ? null : q.optionIds[answers[index]]]);
      const score = Math.round(items.filter((q, index) => q.answer === answers[index]).length / items.length * 10000) / 100;
      const { rows } = await db.query("UPDATE quiz_attempts SET status='SUBMITTED',score=$2,submitted_at=NOW() WHERE attempt_id=$1 RETURNING *", [row.attempt_id, score]);
      return attemptResult(db, { ...row, ...rows[0] }, req.user);
    });
    res.json({ success: true, attempt: result });
  });
  return router;
}
