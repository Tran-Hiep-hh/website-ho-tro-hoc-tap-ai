/** Contracts for the data-access layer. */
import type { Pool, PoolClient } from "pg";
import type {
  AuthUser,
  CreateUserInput,
  CreateSessionInput,
  RotateSessionInput,
  ClassView,
  DocumentRow,
  NotificationRow,
  PublicNotification,
  AssignmentQuestion,
  DatabaseRecord,
  QueryRows,
  FlashcardInput,
  MindmapNodeInput,
  ClassInput,
  SourceDocumentRow,
  ClassDirectoryView,
} from "./domainTypes.js";

export type DatabaseExecutor = Pool | PoolClient;

export interface INotificationRepository {
  findByUserId(userId: string): Promise<NotificationRow[]>;
  markReadThrough(userId: string, notificationId: string): Promise<void>;
  markRead(userId: string, notificationId: string, executor?: DatabaseExecutor): Promise<boolean>;
}

export interface IDocumentRepository {
  findOwned(userId: string, executor?: DatabaseExecutor): Promise<{ rows: DocumentRow[] }>;
  findAccessible(documentId: string, userId: string, allowShared: boolean, executor?: DatabaseExecutor): Promise<{ rows: DocumentRow[] }>;
  lockOwned(executor: DatabaseExecutor, documentId: string, userId: string): Promise<{ rowCount: number }>;
  linked(executor: DatabaseExecutor, documentId: string): Promise<{ rowCount: number }>;
  insert(executor: DatabaseExecutor, values: Array<string | number>): Promise<{ rows: DocumentRow[] }>;
  markDeleted(executor: DatabaseExecutor, documentId: string): Promise<{ rowCount: number }>;
}

export interface IAssignmentRepository {
  listVisible(userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  listHistory(userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  countAttempts(assignmentId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  listSubmitted(userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findActiveClass(classId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findActiveMember(classId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findAssignmentClass(assignmentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findAssignment(assignmentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  createAssignment(values: Array<string | number | boolean | null>, executor?: DatabaseExecutor): Promise<QueryRows>;
  updateAssignment(values: Array<string | number | boolean | null>, executor?: DatabaseExecutor): Promise<QueryRows>;
  cancelAssignment(assignmentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findQuestions(versionId: string, executor?: DatabaseExecutor): Promise<AssignmentQuestion[]>;
  findAnswers(attemptId: string, executor?: DatabaseExecutor): Promise<DatabaseRecord[]>;
}

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<AuthUser | undefined>;
  findUserById(userId: string): Promise<AuthUser | undefined>;
  createUser(input: CreateUserInput): Promise<AuthUser>;
  createSession(input: CreateSessionInput): Promise<boolean>;
  updateProfile(userId: string, fullName: string): Promise<AuthUser | undefined>;
  changePassword(userId: string, oldHash: string, newHash: string): Promise<boolean>;
  rotateSession(input: RotateSessionInput): Promise<AuthUser | undefined>;
  findSessionUser(userId: string, sessionId: string): Promise<AuthUser | undefined>;
  revokeSession(userId: string, sessionId: string): Promise<void>;
}

export interface IQuizRepository {
  listOwned(userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  listAttempts(userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  createContent(values: Array<string | number | boolean | null>, executor?: DatabaseExecutor): Promise<QueryRows>;
  addSource(contentId: string, documentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  createVersion(quizId: string, title: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  createQuestion(versionId: string, question: AssignmentQuestion, order: number, executor?: DatabaseExecutor): Promise<QueryRows>;
  findOwned(contentId: string, userId: string, lock?: boolean, executor?: DatabaseExecutor): Promise<QueryRows>;
  createAttempt(userId: string, versionId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findAttempt(attemptId: string, userId: string, lock?: boolean, executor?: DatabaseExecutor): Promise<QueryRows>;
  findAttemptAnswers(attemptId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  saveAttemptAnswer(attemptId: string, questionId: string, optionId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  submitAttempt(attemptId: string, score: number, executor?: DatabaseExecutor): Promise<QueryRows>;
  findLatestVersion(quizId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findSources(contentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findQuestions(versionId: string, executor?: DatabaseExecutor): Promise<AssignmentQuestion[]>;
}

export interface IStudyRepository {
  listOwned(userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  createContent(values: Array<string | number | boolean | null>, executor?: DatabaseExecutor): Promise<QueryRows>;
  addSource(contentId: string, documentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findCards(contentId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findNodes(contentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findOwned(contentId: string, userId: string, lock?: boolean, executor?: DatabaseExecutor): Promise<QueryRows>;
  findSources(contentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  insertCard(contentId: string, card: FlashcardInput, executor?: DatabaseExecutor): Promise<QueryRows>;
  insertNode(contentId: string, node: MindmapNodeInput, executor?: DatabaseExecutor): Promise<QueryRows>;
}

export interface IClassRepository {
  findVisible(userId: string, executor?: DatabaseExecutor): Promise<ClassDirectoryView>;
  findForUpdate(classId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  update(classId: string, values: ClassInput, executor?: DatabaseExecutor): Promise<QueryRows>;
  create(input: ClassInput & { teacherId: string; joinCode: string }, executor?: DatabaseExecutor): Promise<QueryRows>;
  createJoinRequest(classId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  addMembership(classId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  hasActiveQuiz(classId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  hasMembershipOrRequest(classId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  cancelJoinRequest(requestId: string, classId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findPendingRequest(requestId: string, classId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  setRequestStatus(requestId: string, status: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  removeMember(membershipId: string, classId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  leave(classId: string, userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  findShareableDocuments(documentIds: string[], userId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  addMaterial(classId: string, documentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  removeMaterial(classId: string, documentId: string, executor?: DatabaseExecutor): Promise<QueryRows>;
  deleteCascade(classId: string, executor?: DatabaseExecutor): Promise<void>;
  findActiveByJoinCode(code: string): Promise<DatabaseRecord | undefined>;
}

export interface ISourceDocumentRepository {
  findReadyOwned(userId: string, documentIds: string[]): Promise<{ rows: SourceDocumentRow[]; count: number }>;
}
