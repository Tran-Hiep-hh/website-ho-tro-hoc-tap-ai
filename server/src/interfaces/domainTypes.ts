export type UserRole = "STUDENT" | "TEACHER";
export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export interface AuthUser {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  password_hash?: string;
}

export interface PublicUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface CredentialsInput {
  email: string;
  password: string;
  fullName?: string;
  confirmPassword?: string;
  role?: UserRole;
}

export interface ProfileInput {
  fullName: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface CreateSessionInput {
  userId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  passwordHash: string;
}

export interface RotateSessionInput {
  userId: string;
  sessionId: string;
  oldHash: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface DocumentRow {
  document_id: string | number;
  owner_id: string | number;
  file_name: string;
  file_type: string;
  file_size: string | number;
  created_at: string | Date;
  status: string;
  extracted_text?: string | null;
  storage_path?: string;
}

export interface UploadedDocumentFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface PublicDocument {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  size: string;
  date: string | Date;
  status: string;
  text: string;
}

export interface NotificationRow {
  notification_id: string | number;
  title: string;
  body: string;
  route: string;
  icon: string;
  is_read: boolean;
  created_at: string | Date;
}

export interface PublicNotification {
  id: string;
  title: string;
  text: string;
  route: string;
  icon: string;
  read: boolean;
  date: string | Date;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  fullName: string;
  email: string;
}

export interface ClassInput {
  name: string;
  group?: string;
  description?: string;
}

export interface ClassView {
  classId: string;
  name: string;
  group: string;
  description: string;
  teacherId: string;
  teacherName?: string;
  status: string;
}

export interface AssignmentQuestion {
  id: string;
  text: string;
  options: string[];
  optionIds: string[];
  answer: number;
  explanation: string;
  source: string;
}

export interface QuizGenerationInput {
  sources: string[];
  type: "QUIZ";
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  contentRequest?: string;
  generationMode?: "MOCK" | "DEEPSEEK" | "OPENROUTER";
  generationModel?: string;
  questionCount?: number;
  answerPositionRequest?: string;
}

export interface StudyGenerationInput {
  sources: string[];
  type: "FLASHCARD" | "MINDMAP";
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  contentRequest?: string;
  generationMode?: "MOCK" | "DEEPSEEK" | "OPENROUTER";
  generationModel?: string;
}

export interface StudyMaterialView {
  id: string;
  type: "FLASHCARD" | "MINDMAP";
  title: string;
  persisted: boolean;
  sources: string[];
  cards?: Array<{ id: string; front: string; back: string; keyword: string }>;
  nodes?: Array<{ id: string; parent: string | null; label: string }>;
}

export interface QuizContentView {
  id: string;
  persisted: boolean;
  type: "QUIZ";
  title: string;
  status: string;
  sources: string[];
  versionId: string;
  questions: AssignmentQuestion[];
}

export type DatabaseScalar = string | number | boolean | Date | null;
export type DatabaseValue =
  | DatabaseScalar
  | DatabaseScalar[]
  | { [key: string]: DatabaseScalar | DatabaseScalar[] };
export type DatabaseRecord = { [key: string]: DatabaseValue };

export interface QueryRows<T extends DatabaseRecord = DatabaseRecord> {
  rows: T[];
  rowCount: number;
}

export interface GeneratedQuizView {
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questions: AssignmentQuestion[];
  generationMode: "MOCK" | "DEEPSEEK" | "OPENROUTER";
  generationModel?: string;
  sources: string[];
}

export interface GeneratedStudyView {
  title: string;
  type: "FLASHCARD" | "MINDMAP";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  cards?: Array<{ front: string; back: string; keyword: string }>;
  nodes?: Array<{ parent: string | null; label: string }>;
  generationMode: "MOCK" | "DEEPSEEK" | "OPENROUTER";
  generationModel?: string;
  sources: string[];
}

export interface ClassDirectoryView {
  classes: DatabaseRecord[];
  members: DatabaseRecord[];
  requests: DatabaseRecord[];
  links: DatabaseRecord[];
}

export interface FlashcardInput {
  front: string;
  back: string;
  keyword: string;
  order: number;
}

export interface MindmapNodeInput {
  parentId: string | null;
  label: string;
  order: number;
}

export interface SourceDocumentRow {
  document_id: string | number;
  file_name: string;
  extracted_text: string;
}
