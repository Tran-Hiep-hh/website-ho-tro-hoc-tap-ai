import { pool } from "../config/database.js";

export function createQuizRepository(database = pool) {
  return {
    async listOwned(ownerId, executor = database) {
      return executor.query("SELECT * FROM generated_contents WHERE owner_id=$1 AND content_type='QUIZ' AND status <> 'DELETED' ORDER BY created_at DESC", [ownerId]);
    },
    async listAttempts(ownerId, executor = database) {
      return executor.query("SELECT a.*,v.quiz_id,v.title FROM quiz_attempts a JOIN quiz_versions v USING(quiz_version_id) WHERE a.user_id=$1 AND a.assignment_id IS NULL AND a.status='SUBMITTED' ORDER BY a.submitted_at", [ownerId]);
    },
    async createContent(values, executor = database) {
      return executor.query("INSERT INTO generated_contents (owner_id,content_type,title,difficulty,status,generation_settings) VALUES ($1,'QUIZ',$2,$3,'READY',$4) RETURNING *", values);
    },
    async addSource(contentId, documentId, executor = database) {
      return executor.query("INSERT INTO content_sources (content_id,document_id) VALUES ($1,$2)", [contentId, documentId]);
    },
    async createVersion(quizId, title, executor = database) {
      return executor.query("INSERT INTO quiz_versions (quiz_id,version_number,title) SELECT $1,COALESCE(MAX(version_number),0)+1,$2 FROM quiz_versions WHERE quiz_id=$1 RETURNING quiz_version_id", [quizId, title]);
    },
    async createQuestion(versionId, question, order, executor = database) {
      return executor.query("INSERT INTO quiz_questions (quiz_version_id,question_text,explanation,source_label,display_order) VALUES ($1,$2,$3,$4,$5) RETURNING question_id", [versionId, question.text, question.explanation, question.source, order]);
    },
    async createOption(questionId, option, correct, order, executor = database) {
      return executor.query("INSERT INTO answer_options (question_id,option_text,is_correct,display_order) VALUES ($1,$2,$3,$4)", [questionId, option, correct, order]);
    },
    async updateTitle(contentId, title, executor = database) {
      return executor.query("UPDATE generated_contents SET title=$2 WHERE content_id=$1", [contentId, title]);
    },
    async lockTeacherClasses(ownerId, executor = database) {
      return executor.query("SELECT class_id FROM classrooms WHERE teacher_id=$1 ORDER BY class_id FOR UPDATE", [ownerId]);
    },
    async deleteAttempts(contentId, executor = database) {
      return executor.query("DELETE FROM quiz_attempts WHERE assignment_id IS NULL AND quiz_version_id IN (SELECT quiz_version_id FROM quiz_versions WHERE quiz_id=$1)", [contentId]);
    },
    async unlinkMaterials(contentId, executor = database) {
      return executor.query("DELETE FROM class_materials WHERE content_id=$1", [contentId]);
    },
    async markDeleted(contentId, executor = database) {
      return executor.query("UPDATE generated_contents SET status='DELETED' WHERE content_id=$1", [contentId]);
    },
    async findInProgressAttempt(userId, versionId, executor = database) {
      return executor.query("SELECT * FROM quiz_attempts WHERE user_id=$1 AND quiz_version_id=$2 AND assignment_id IS NULL AND status='IN_PROGRESS' ORDER BY attempt_id DESC LIMIT 1", [userId, versionId]);
    },
    async createAttempt(userId, versionId, executor = database) {
      return executor.query("INSERT INTO quiz_attempts (user_id,quiz_version_id,attempt_number,status,started_at) SELECT $1,$2,COALESCE(MAX(attempt_number),0)+1,'IN_PROGRESS',NOW() FROM quiz_attempts WHERE user_id=$1 AND quiz_version_id=$2 AND assignment_id IS NULL RETURNING *", [userId, versionId]);
    },
    async findAttempt(attemptId, ownerId, lock = false, executor = database) {
      return executor.query(`SELECT a.*, v.quiz_id, v.title FROM quiz_attempts a JOIN quiz_versions v USING(quiz_version_id) WHERE a.attempt_id=$1 AND a.user_id=$2 AND a.assignment_id IS NULL${lock ? " FOR UPDATE OF a" : ""}`, [attemptId, ownerId]);
    },
    async findAttemptAnswers(attemptId, executor = database) {
      return executor.query("SELECT question_id,selected_option_id FROM attempt_answers WHERE attempt_id=$1", [attemptId]);
    },
    async saveAttemptAnswer(attemptId, questionId, optionId, executor = database) {
      return executor.query("INSERT INTO attempt_answers (attempt_id,question_id,selected_option_id) VALUES ($1,$2,$3)", [attemptId, questionId, optionId]);
    },
    async submitAttempt(attemptId, score, executor = database) {
      return executor.query("UPDATE quiz_attempts SET status='SUBMITTED',score=$2,submitted_at=NOW() WHERE attempt_id=$1 RETURNING *", [attemptId, score]);
    },
    async findOwned(contentId, ownerId, lock = false, executor = database) {
      return executor.query(`SELECT * FROM generated_contents WHERE content_id=$1 AND owner_id=$2 AND content_type='QUIZ' AND status <> 'DELETED'${lock ? " FOR UPDATE" : ""}`, [contentId, ownerId]);
    },
    async findQuestions(versionId, executor = database) {
      const { rows } = await executor.query("SELECT q.*, json_agg(json_build_object('id',o.option_id::text,'text',o.option_text,'correct',o.is_correct) ORDER BY o.display_order) AS options FROM quiz_questions q JOIN answer_options o USING(question_id) WHERE quiz_version_id=$1 GROUP BY q.question_id ORDER BY q.display_order", [versionId]);
      return rows.map((question) => ({ id: String(question.question_id), text: question.question_text, options: question.options.map((option) => option.text), optionIds: question.options.map((option) => option.id), answer: question.options.findIndex((option) => option.correct), explanation: question.explanation, source: question.source_label ?? "" }));
    },
    async findLatestVersion(quizId, executor = database) {
      return executor.query("SELECT * FROM quiz_versions WHERE quiz_id=$1 AND assignment_only=FALSE ORDER BY version_number DESC LIMIT 1", [quizId]);
    },
    async findSources(contentId, executor = database) {
      return executor.query("SELECT document_id FROM content_sources WHERE content_id=$1 ORDER BY document_id", [contentId]);
    },
  };
}
