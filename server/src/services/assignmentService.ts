import { httpError } from "../utils/httpError.js";
import { withTransaction } from "../repositories/withTransaction.js";
import type { IAssignmentService } from "../interfaces/serviceInterfaces.js";
import type { AuthenticatedUser, ClassView } from "../interfaces/domainTypes.js";
import type { DatabaseRecord } from "../interfaces/domainTypes.js";
import type { DatabaseExecutor } from "../interfaces/repositoryInterfaces.js";

interface AssignmentUser {
  role: string;
  userId: string | number;
}

interface AssignmentRepository {
  findActiveClass(classId: string, executor: unknown): Promise<{ rows: Array<{ teacher_id: string | number }> }>;
  findActiveMember(classId: string, userId: string | number, executor: unknown): Promise<{ rowCount: number }>;
  findAssignmentClass(assignmentId: string, executor: unknown): Promise<{ rowCount: number; rows: Array<{ class_id: string | number }> }>;
  findAssignment(assignmentId: string, executor: unknown): Promise<{ rows: unknown[] }>;
}

const validId = (value: unknown): boolean => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(String(value)) <= 9223372036854775807n;
const missing = () => httpError(404, "Không tìm thấy bài giao hoặc bạn không có quyền truy cập.");

export class AssignmentService implements IAssignmentService {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly database: DatabaseExecutor,
  ) {}

  async runInTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T> {
    return withTransaction(this.database, work);
  }

  async classAccess(executor: DatabaseExecutor, user: AuthenticatedUser, classId: string, own = false): Promise<ClassView> {
    if (!validId(classId)) throw missing();
    const { rows } = await this.repository.findActiveClass(classId, executor);
    const classroom = rows[0];
    if (!classroom) throw missing();
    if (own) {
      if (user.role !== "TEACHER") throw httpError(403, "Chỉ giáo viên được giao Quiz.");
      if (String(classroom.teacher_id) !== String(user.userId)) throw missing();
    } else {
      if (user.role !== "STUDENT") throw httpError(403, "Chỉ học sinh được làm bài giao.");
      const member = await this.repository.findActiveMember(classId, user.userId, executor);
      if (!member.rowCount) throw missing();
    }
    return classroom as unknown as ClassView;
  }

  async access(executor: DatabaseExecutor, user: AuthenticatedUser, assignmentId: string, own = false): Promise<DatabaseRecord> {
    if (!validId(assignmentId)) throw missing();
    const lookup = await this.repository.findAssignmentClass(assignmentId, executor);
    if (!lookup.rowCount) throw missing();
    await this.classAccess(executor, user, String(lookup.rows[0].class_id), own);
    const { rows } = await this.repository.findAssignment(assignmentId, executor);
    return rows[0] as DatabaseRecord;
  }
}

export function createAssignmentService(repository: AssignmentRepository, database: DatabaseExecutor): IAssignmentService {
  return new AssignmentService(repository, database);
}
