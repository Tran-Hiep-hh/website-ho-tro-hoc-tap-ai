/** Contracts for the application-service layer. */

import type {
  AuthSession,
  AuthenticatedUser,
  ChangePasswordInput,
  ClassInput,
  ClassView,
  CredentialsInput,
  LoginInput,
  ProfileInput,
  PublicDocument,
  PublicNotification,
  PublicUser,
  QuizGenerationInput,
  QuizContentView,
  RegisterInput,
  StudyGenerationInput,
  StudyMaterialView,
  AssignmentQuestion,
  DocumentRow,
  DatabaseRecord,
  GeneratedQuizView,
  GeneratedStudyView,
  ClassDirectoryView,
  UploadedDocumentFile,
} from "./domainTypes.js";
import type { DatabaseExecutor } from "./repositoryInterfaces.js";

export interface INotificationService {
  list(userId: string): Promise<PublicNotification[]>;
  markReadThrough(userId: string, notificationId: string): Promise<void>;
  markRead(userId: string, notificationId: string): Promise<void>;
}

export interface IDocumentService {
  list(userId: string): Promise<PublicDocument[]>;
  upload(userId: string, file: UploadedDocumentFile): Promise<PublicDocument>;
  get(userId: string, documentId: string): Promise<PublicDocument>;
  download(userId: string, documentId: string): Promise<DocumentRow>;
  remove(userId: string, documentId: string): Promise<void>;
}

export interface IAssignmentService {
  classAccess(executor: DatabaseExecutor, user: AuthenticatedUser, classId: string, own?: boolean): Promise<ClassView>;
  access(executor: DatabaseExecutor, user: AuthenticatedUser, assignmentId: string, own?: boolean): Promise<DatabaseRecord>;
  runInTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T>;
}

export interface IAuthService {
  register(input: RegisterInput): Promise<PublicUser>;
  login(credentials: LoginInput): Promise<AuthSession>;
  refresh(token: string): Promise<AuthSession>;
  logout(refreshToken?: string, accessToken?: string): Promise<void>;
  updateProfile(userId: string, input: ProfileInput): Promise<PublicUser>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
}

export interface IMaterialGenerationService {
  generateQuiz(userId: string, input: QuizGenerationInput): Promise<GeneratedQuizView>;
  generateStudyMaterial(userId: string, input: StudyGenerationInput): Promise<GeneratedStudyView>;
}

export interface IStudyContentService {
  material(executor: DatabaseExecutor, row: DatabaseRecord): Promise<StudyMaterialView>;
  owned(executor: DatabaseExecutor, userId: string, contentId: string, lock?: boolean): Promise<DatabaseRecord>;
  runInTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T>;
}

export interface IQuizContentService {
  content(executor: DatabaseExecutor, row: DatabaseRecord): Promise<QuizContentView>;
  owned(executor: DatabaseExecutor, userId: string, contentId: string, lock?: boolean): Promise<DatabaseRecord>;
  questions(executor: DatabaseExecutor, versionId: string): Promise<AssignmentQuestion[]>;
  runInTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T>;
}

export interface IClassService {
  create(userId: string, input: ClassInput): Promise<string>;
  lookup(code: string): Promise<ClassView>;
  visible(executor: DatabaseExecutor, userId: string): Promise<ClassDirectoryView>;
  getOwnedClass(executor: DatabaseExecutor, user: AuthenticatedUser, classId: string, teacherOnly?: boolean): Promise<ClassView>;
  runInTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T>;
}
