import { pool } from "../config/database.js";
import type { IAssignmentRepository } from "../interfaces/repositoryInterfaces.js";

export class AssignmentRepository implements IAssignmentRepository {
  constructor(private readonly database: any = pool) {}

async finishAttempt(attemptId, score, submittedAt, executor = this.database) {
  return executor.query("UPDATE quiz_attempts SET status='SUBMITTED',score=$2,submitted_at=$3 WHERE attempt_id=$1 RETURNING *", [attemptId, score, submittedAt]);
}
async findForExpiry(assignmentId, executor = this.database) {
  return executor.query("SELECT * FROM quiz_assignments WHERE assignment_id=$1 FOR UPDATE", [assignmentId]);
}
async findInProgress(assignmentId, executor = this.database) {
  return executor.query("SELECT * FROM quiz_attempts WHERE assignment_id=$1 AND status='IN_PROGRESS' FOR UPDATE", [assignmentId]);
}
async listVisible(userId, executor = this.database) {
  return executor.query("SELECT a.*,v.quiz_id FROM quiz_assignments a JOIN quiz_versions v USING(quiz_version_id) JOIN classrooms c USING(class_id) WHERE a.deleted_at IS NULL AND (c.teacher_id=$1 OR (c.status='ACTIVE' AND a.status='PUBLISHED' AND EXISTS(SELECT 1 FROM class_memberships m WHERE m.class_id=c.class_id AND m.student_id=$1 AND m.status='ACTIVE'))) ORDER BY a.assignment_id", [userId]);
}
async listHistory(userId, executor = this.database) {
  return executor.query("SELECT DISTINCT assignment_id FROM quiz_attempts WHERE user_id=$1 AND assignment_id IS NOT NULL", [userId]);
}
async countAttempts(assignmentId, userId, executor = this.database) {
  return executor.query("SELECT COUNT(*)::integer AS used,BOOL_OR(status='IN_PROGRESS') AS ongoing FROM quiz_attempts WHERE assignment_id=$1 AND user_id=$2", [assignmentId, userId]);
}
async listSubmitted(userId, executor = this.database) {
  return executor.query("SELECT t.*,a.class_id,c.class_name,a.title,a.show_answers,v.quiz_id,c.teacher_id,u.full_name,u.email FROM quiz_attempts t JOIN quiz_assignments a USING(assignment_id) JOIN quiz_versions v ON v.quiz_version_id=t.quiz_version_id JOIN classrooms c ON c.class_id=a.class_id JOIN users u ON u.user_id=t.user_id WHERE t.status='SUBMITTED' AND (t.user_id=$1 OR c.teacher_id=$1) ORDER BY t.submitted_at", [userId]);
}
async findReadyQuiz(contentId, ownerId, executor = this.database) {
  return executor.query("SELECT content_id FROM generated_contents WHERE content_id=$1 AND owner_id=$2 AND content_type='QUIZ' AND status='READY' FOR UPDATE", [contentId, ownerId]);
}
async findPublicVersion(quizId, executor = this.database) {
  return executor.query("SELECT quiz_version_id FROM quiz_versions WHERE quiz_id=$1 AND assignment_only=FALSE ORDER BY version_number DESC LIMIT 1", [quizId]);
}
async createAssignment(values, executor = this.database) {
  return executor.query("INSERT INTO quiz_assignments(class_id,quiz_version_id,title,start_at,due_at,max_attempts,show_answers,status,duration_minutes,shuffle_questions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING assignment_id", values);
}
async findOriginalContent(versionId, executor = this.database) {
  return executor.query("SELECT g.content_id FROM generated_contents g JOIN quiz_versions v ON v.quiz_id=g.content_id WHERE v.quiz_version_id=$1 FOR UPDATE OF g", [versionId]);
}
async createAssignmentVersion(quizId, title, executor = this.database) {
  return executor.query("INSERT INTO quiz_versions(quiz_id,version_number,title,assignment_only) SELECT $1,COALESCE(MAX(version_number),0)+1,$2,TRUE FROM quiz_versions WHERE quiz_id=$1 RETURNING quiz_version_id", [quizId, title]);
}
async createQuestion(versionId, question, order, executor = this.database) {
  return executor.query("INSERT INTO quiz_questions(quiz_version_id,question_text,explanation,source_label,display_order) VALUES ($1,$2,$3,$4,$5) RETURNING question_id", [versionId, question.text, question.explanation, question.source, order]);
}
async createOption(questionId, option, correct, order, executor = this.database) {
  return executor.query("INSERT INTO answer_options(question_id,option_text,is_correct,display_order) VALUES ($1,$2,$3,$4)", [questionId, option, correct, order]);
}
async updateAssignment(values, executor = this.database) {
  return executor.query("UPDATE quiz_assignments SET title=$2,quiz_version_id=$3,start_at=$4,due_at=$5,max_attempts=$6,duration_minutes=$7,show_answers=$8,shuffle_questions=$9 WHERE assignment_id=$1", values);
}
async deleteAssignmentAttempts(assignmentId, executor = this.database) {
  return executor.query("DELETE FROM quiz_attempts WHERE assignment_id=$1", [assignmentId]);
}
async cancelAssignment(assignmentId, executor = this.database) {
  return executor.query("UPDATE quiz_assignments SET status='CANCELLED',deleted_at=COALESCE(deleted_at,NOW()) WHERE assignment_id=$1", [assignmentId]);
}
async publish(assignmentId, executor = this.database) {
  return executor.query("UPDATE quiz_assignments SET status='PUBLISHED' WHERE assignment_id=$1", [assignmentId]);
}
async findAttempts(assignmentId, userId, executor = this.database) {
  return executor.query("SELECT * FROM quiz_attempts WHERE assignment_id=$1 AND user_id=$2 ORDER BY attempt_number DESC", [assignmentId, userId]);
}
async findQuizIdByVersion(versionId, executor = this.database) {
  return executor.query("SELECT quiz_id FROM quiz_versions WHERE quiz_version_id=$1", [versionId]);
}
async createAssignedAttempt(userId, versionId, assignmentId, attemptNumber, questionOrder, executor = this.database) {
  return executor.query("INSERT INTO quiz_attempts(user_id,quiz_version_id,assignment_id,attempt_number,started_at,question_order) VALUES ($1,$2,$3,$4,NOW(),$5) RETURNING *", [userId, versionId, assignmentId, attemptNumber, JSON.stringify(questionOrder)]);
}
async findAttemptAssignment(attemptId, userId, executor = this.database) {
  return executor.query("SELECT assignment_id FROM quiz_attempts WHERE attempt_id=$1 AND user_id=$2 AND assignment_id IS NOT NULL", [attemptId, userId]);
}
async findAttemptForUpdate(attemptId, executor = this.database) {
  return executor.query("SELECT * FROM quiz_attempts WHERE attempt_id=$1 FOR UPDATE", [attemptId]);
}
async saveAnswer(attemptId, questionId, optionId, executor = this.database) {
  return executor.query("INSERT INTO attempt_answers(attempt_id,question_id,selected_option_id) VALUES ($1,$2,$3) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_id=EXCLUDED.selected_option_id", [attemptId, questionId, optionId]);
}
async incrementRevision(attemptId, executor = this.database) {
  return executor.query("UPDATE quiz_attempts SET answer_revision=answer_revision+1 WHERE attempt_id=$1", [attemptId]);
}
async findActiveClass(classId, executor = this.database) {
  return executor.query("SELECT * FROM classrooms WHERE class_id=$1 AND status='ACTIVE' FOR UPDATE", [classId]);
}
async findActiveMember(classId, userId, executor = this.database) {
  return executor.query("SELECT 1 FROM class_memberships WHERE class_id=$1 AND student_id=$2 AND status='ACTIVE'", [classId, userId]);
}
async findAssignmentClass(assignmentId, executor = this.database) {
  return executor.query("SELECT class_id FROM quiz_assignments WHERE assignment_id=$1", [assignmentId]);
}
async findAssignment(assignmentId, executor = this.database) {
  return executor.query("SELECT * FROM quiz_assignments WHERE assignment_id=$1 FOR UPDATE", [assignmentId]);
}
async findQuestions(versionId, executor = this.database) {
  const { rows } = await executor.query(
    "SELECT q.*,json_agg(json_build_object('id',o.option_id::text,'text',o.option_text,'correct',o.is_correct) ORDER BY o.display_order) AS options FROM quiz_questions q JOIN answer_options o USING(question_id) WHERE quiz_version_id=$1 GROUP BY q.question_id ORDER BY q.display_order",
    [versionId],
  );
  return rows.map((question) => ({
    id: String(question.question_id),
    text: question.question_text,
    options: question.options.map((option) => option.text),
    optionIds: question.options.map((option) => option.id),
    answer: question.options.findIndex((option) => option.correct),
    explanation: question.explanation,
    source: question.source_label ?? "",
  }));
}
async findAnswers(attemptId, executor = this.database) {
  const { rows } = await executor.query(
    "SELECT question_id,selected_option_id FROM attempt_answers WHERE attempt_id=$1",
    [attemptId],
  );
  return rows;
}
}

export function createAssignmentRepository(database: any = pool): IAssignmentRepository {
  return new AssignmentRepository(database);
}
