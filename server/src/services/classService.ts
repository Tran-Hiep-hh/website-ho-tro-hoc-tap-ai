// @ts-nocheck
import { randomBytes } from "node:crypto";
import { withTransaction } from "../repositories/withTransaction.js";
import { httpError } from "../utils/httpError.js";
import type { IClassService } from "../interfaces/serviceInterfaces.js";

const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;
const missing = () => httpError(404, "Lớp không tồn tại hoặc bạn không có quyền truy cập.");

function text(value, max, required = true) {
  if (typeof value !== "string" || value.includes("\0") || value.length > max || (required && !value.trim())) {
    throw httpError(400, "Thông tin lớp trống hoặc vượt độ dài cho phép.");
  }
  return value.trim();
}

function classFields(body = {}) {
  return {
    name: text(body?.name, 100),
    group: text(body?.group ?? "", 100, false),
    description: text(body?.description ?? "", 1000, false),
  };
}

export class ClassService implements IClassService {
  constructor(public readonly repository: any, private readonly database: unknown) {}

  readonly validateFields = classFields;

  async runInTransaction<T>(work: (executor: unknown) => Promise<T>): Promise<T> {
    return withTransaction(this.database, work);
  }

  async visible(executor: unknown, userId: string): Promise<unknown> {
    return this.repository.findVisible(userId, executor);
  }

  async update(executor: unknown, classId: string, values: unknown): Promise<unknown> {
    return this.repository.update(classId, values, executor);
  }

  async getOwnedClass(executor: unknown, user: any, id: string, teacherOnly = false): Promise<unknown> {
      if (teacherOnly && user.role !== "TEACHER") throw httpError(403, "Chỉ giáo viên được quản lý lớp học.");
      if (!validId(id)) throw missing();
      const { rows } = await this.repository.findForUpdate(id, executor);
      if (!rows[0] || (teacherOnly && String(rows[0].teacher_id) !== String(user.userId))) throw missing();
      return rows[0];
  }

  async ensureNoActiveQuiz(executor: unknown, classId: string): Promise<void> {
      const active = await this.repository.hasActiveQuiz(classId, executor);
      if (active.rowCount) throw httpError(409, "Lớp đang có Quiz diễn ra. Chờ bài giao kết thúc trước khi xóa, rời lớp hoặc xóa thành viên.");
  }

  async requestJoin(executor: unknown, classroom: any, userId: string): Promise<void> {
      const existing = await this.repository.hasMembershipOrRequest(classroom.class_id, userId, executor);
      if (existing.rowCount) throw httpError(409, "Bạn đã tham gia hoặc đang chờ duyệt lớp này.");
      await this.repository.createJoinRequest(classroom.class_id, userId, executor);
  }

  async cancelRequest(executor: unknown, requestId: string, classroomId: string, userId: string): Promise<void> {
      const result = await this.repository.cancelJoinRequest(requestId, classroomId, userId, executor);
      if (!result.rowCount) throw httpError(409, "Yêu cầu không còn chờ duyệt hoặc không thuộc về bạn. Danh sách lớp sẽ được cập nhật; nếu đã được duyệt, bạn có thể chọn rời lớp.");
  }

  async decideRequest(executor: unknown, requestId: string, classroomId: string, approve: boolean): Promise<any> {
      const { rows } = await this.repository.findPendingRequest(requestId, classroomId, executor);
      if (!rows[0]) throw httpError(409, "Yêu cầu đã được xử lý hoặc không thuộc lớp.");
      await this.repository.setRequestStatus(rows[0].request_id, approve ? "APPROVED" : "REJECTED", executor);
      if (approve) await this.repository.addMembership(classroomId, rows[0].student_id, executor);
      return rows[0];
  }

  async removeMember(executor: unknown, membershipId: string, classroomId: string): Promise<unknown> {
    return this.repository.removeMember(membershipId, classroomId, executor);
  }

  async leave(executor: unknown, classroomId: string, userId: string): Promise<unknown> {
    return this.repository.leave(classroomId, userId, executor);
  }

  async shareMaterials(executor: unknown, classroomId: string, ownerId: string, documentIds: string[]): Promise<any> {
      const unique = [...new Set(documentIds.map(String))];
      const docs = await this.repository.findShareableDocuments(unique, ownerId, executor);
      if (docs.rowCount !== unique.length) throw httpError(400, "Chỉ chia sẻ tài liệu của bạn đã được xử lý và chưa xóa.");
      let added = 0;
      for (const id of unique) added += (await this.repository.addMaterial(classroomId, id, executor)).rowCount;
      return { added, unique };
  }

  async unshareMaterial(executor: unknown, classroomId: string, documentId: string): Promise<unknown> {
    return this.repository.removeMaterial(classroomId, documentId, executor);
  }

  async deleteClass(executor: unknown, classroomId: string): Promise<void> {
    await this.repository.deleteCascade(classroomId, executor);
  }

  async lookup(code: string): Promise<unknown> {
      const joinCode = text(code, 20).toUpperCase();
      const classroom = await this.repository.findActiveByJoinCode(joinCode);
      if (!classroom) throw httpError(404, "Không tìm thấy lớp với mã này.");
      return classroom;
  }

  async create(teacherId: string, body: unknown): Promise<string> {
      const fields = classFields(body);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const classroom = await this.repository.create({
            teacherId,
            ...fields,
            joinCode: randomBytes(5).toString("hex").toUpperCase(),
          });
          return String(classroom.class_id);
        } catch (error) {
          if (error.code !== "23505") throw error;
        }
      }
      throw httpError(503, "Không tạo được mã lớp. Vui lòng thử lại.");
  }
}

export function createClassService(repository: any, database: unknown): IClassService {
  return new ClassService(repository, database);
}
