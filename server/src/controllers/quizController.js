import { pool } from "../config/database.js";
import { authRateLimit } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";
import { generationSettings } from "../services/aiMaterialGenerator.js";
import { aiError } from "../utils/aiError.js";
import { createSourceDocumentRepository } from "../repositories/sourceDocumentRepository.js";
import { createQuizRepository } from "../repositories/quizRepository.js";
import { createQuizContentService } from "../services/quizContentService.js";
import { createMaterialGenerationService } from "../services/materialGenerationService.js";
import { difficulties, quizSettings as settings, text, validateQuestions } from "../validators/quizValidator.js";

const notFound = () => httpError(404, "Không tìm thấy Quiz hoặc lượt làm của bạn.");
const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

export function createQuizController({ database = pool, quizRepository = createQuizRepository(database), quizContentService = createQuizContentService(quizRepository, difficulties, database), materialGenerationService = createMaterialGenerationService({ sourceDocumentRepository: createSourceDocumentRepository(database) }) } = {}) {
  const handlers = {};
  async function sources(db, owner, ids) {
    const result = await createSourceDocumentRepository(db).findReadyOwned(owner, ids);
    if (result.count !== ids.length) throw httpError(400, "Tài liệu nguồn phải thuộc về bạn, còn tồn tại và có văn bản sẵn sàng.");
    return ids.map((id) => result.rows.find((row) => String(row.document_id) === id));
  }
  async function writeVersion(db, quizId, title, items) {
    const { rows } = await quizRepository.createVersion(quizId, title, db);
    for (const [index, question] of items.entries()) {
      const result = await quizRepository.createQuestion(rows[0].quiz_version_id, question, index + 1, db);
      for (const [optionIndex, option] of question.options.entries()) await quizRepository.createOption(result.rows[0].question_id, option, question.answer === optionIndex, optionIndex + 1, db);
    }
  }
  async function attempt(db, owner, id, lock = false) {
    if (!validId(id)) throw notFound();
    const { rows } = await quizRepository.findAttempt(id, owner, lock, db);
    if (!rows[0]) throw notFound();
    return rows[0];
  }
  async function attemptResult(db, row, user) {
    const items = await quizContentService.questions(db, row.quiz_version_id);
    const { rows } = await quizRepository.findAttemptAnswers(row.attempt_id, db);
    const answers = items.map((question) => question.optionIds.indexOf(String(rows.find((answer) => String(answer.question_id) === question.id)?.selected_option_id)));
    return { id: String(row.attempt_id), attemptNumber: row.attempt_number, persisted: true, contentId: String(row.quiz_id), assignmentId: null, title: row.title, userId: String(user.userId), name: user.fullName, status: row.status, date: row.submitted_at ?? row.started_at, score: row.score === null ? null : Number(row.score), showAnswers: true, answers, questions: items };
  }

  handlers.generate = async (req, res) => {
    const input = settings(req.body);
    const quantity = Number(req.body.quantity ?? 5);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30) throw httpError(400, "Chọn từ 1 đến 30 câu hỏi.");
    const generated = await materialGenerationService.generateQuiz(req.user.userId, { ...input, quantity });
    try {
      generated.questions = validateQuestions(generated.questions);
      if (generated.questions.length !== quantity) throw new Error("quantity");
    } catch { throw aiError(502, "AI trả về câu hỏi không hợp lệ hoặc chưa đủ số lượng. Hãy giảm số câu hoặc thử lại."); }
    res.json({ success: true, content: generated });
  };

  handlers.list = async (req, res) => {
    const { rows } = await quizRepository.listOwned(req.user.userId, database);
    res.json({ success: true, contents: await Promise.all(rows.map((row) => quizContentService.content(database, row))) });
  };
  handlers.listAttempts = async (req, res) => {
    const { rows } = await quizRepository.listAttempts(req.user.userId, database);
    res.json({ success: true, attempts: await Promise.all(rows.map((row) => attemptResult(database, row, req.user))) });
  };
  handlers.create = async (req, res) => {
    const input = settings(req.body), items = validateQuestions(req.body.questions);
    const result = await quizContentService.runInTransaction(async (db) => {
      await sources(db, req.user.userId, input.sources);
      const { rows } = await quizRepository.createContent([req.user.userId, input.title, difficulties[input.difficulty], { ...generationSettings(req.body), contentRequest: input.contentRequest }], db);
      for (const id of input.sources) await quizRepository.addSource(rows[0].content_id, id, db);
      await writeVersion(db, rows[0].content_id, input.title, items);
      return quizContentService.content(db, rows[0]);
    });
    res.status(201).json({ success: true, content: result });
  };
  handlers.update = async (req, res) => {
    const title = text(req.body.title, 150), items = validateQuestions(req.body.questions);
    const result = await quizContentService.runInTransaction(async (db) => {
      const row = await quizContentService.owned(db, req.user.userId, req.params.id, true);
      const latest = await quizRepository.findLatestVersion(row.content_id, db);
      if (String(req.body.versionId) !== String(latest.rows[0].quiz_version_id)) throw httpError(409, "Quiz đã được sửa ở nơi khác. Tải lại trang trước khi chỉnh sửa.");
      await quizRepository.updateTitle(row.content_id, title, db);
      await writeVersion(db, row.content_id, title, items);
      return quizContentService.content(db, { ...row, title });
    });
    res.json({ success: true, content: result });
  };
  handlers.remove = async (req, res) => {
    await quizContentService.runInTransaction(async (db) => {
      await quizRepository.lockTeacherClasses(req.user.userId, db);
      const row = await quizContentService.owned(db, req.user.userId, req.params.id, true);
      await quizRepository.deleteAttempts(row.content_id, db);
      await quizRepository.unlinkMaterials(row.content_id, db);
      await quizRepository.markDeleted(row.content_id, db);
    });
    res.json({ success: true });
  };
  handlers.startAttempt = async (req, res) => {
    const result = await quizContentService.runInTransaction(async (db) => {
      const row = await quizContentService.owned(db, req.user.userId, req.params.id, true);
      const { rows: versions } = await quizRepository.findLatestVersion(row.content_id, db);
      const version = versions[0].quiz_version_id;
      let { rows } = await quizRepository.findInProgressAttempt(req.user.userId, version, db);
      if (!rows.length) ({ rows } = await quizRepository.createAttempt(req.user.userId, version, db));
      const items = await quizContentService.questions(db, version);
      return { id: String(rows[0].attempt_id), title: row.title, questions: items.map(({ answer, explanation, source, optionIds, ...question }) => question) };
    });
    res.json({ success: true, attempt: result });
  };
  handlers.submitAttempt = async (req, res) => {
    const result = await quizContentService.runInTransaction(async (db) => {
      const row = await attempt(db, req.user.userId, req.params.id, true);
      if (row.status === "SUBMITTED") return attemptResult(db, row, req.user);
      const items = await quizContentService.questions(db, row.quiz_version_id), answers = req.body.answers;
      if (!Array.isArray(answers) || answers.length !== items.length || !answers.every((answer) => Number.isInteger(answer) && answer >= -1 && answer <= 3)) throw httpError(400, "Danh sách câu trả lời không hợp lệ.");
      for (const [index, question] of items.entries()) await quizRepository.saveAttemptAnswer(row.attempt_id, question.id, answers[index] === -1 ? null : question.optionIds[answers[index]], db);
      const score = Math.round(items.filter((question, index) => question.answer === answers[index]).length / items.length * 10000) / 100;
      const { rows } = await quizRepository.submitAttempt(row.attempt_id, score, db);
      return attemptResult(db, { ...row, ...rows[0] }, req.user);
    });
    res.json({ success: true, attempt: result });
  };
  return handlers;
}
