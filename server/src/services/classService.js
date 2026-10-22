import { randomBytes } from "node:crypto";
import { withTransaction } from "../repositories/withTransaction.js";
import { httpError } from "../utils/httpError.js";

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

export function createClassService(repository, database) {
  return {
    repository,
    validateFields: classFields,
    async runInTransaction(work) {
      return withTransaction(database, work);
    },
    async visible(executor, userId) {
      return repository.findVisible(userId, executor);
    },
    async update(executor, classId, values) {
      return repository.update(classId, values, executor);
    },
    async getOwnedClass(executor, user, id, teacherOnly = false) {
      if (teacherOnly && user.role !== "TEACHER") throw httpError(403, "Chỉ giáo viên được quản lý lớp học.");
      if (!validId(id)) throw missing();
      const { rows } = await repository.findForUpdate(id, executor);
      if (!rows[0] || (teacherOnly && String(rows[0].teacher_id) !== String(user.userId))) throw missing();
      return rows[0];
    },
    async ensureNoActiveQuiz(executor, classId) {
      const active = await repository.hasActiveQuiz(classId, executor);
      if (active.rowCount) throw httpError(409, "Lớp đang có Quiz diễn ra. Chờ bài giao kết thúc trước khi xóa, rời lớp hoặc xóa thành viên.");
    },
    async requestJoin(executor, classroom, userId) {
      const existing = await repository.hasMembershipOrRequest(classroom.class_id, userId, executor);
      if (existing.rowCount) throw httpError(409, "Bạn đã tham gia hoặc đang chờ duyệt lớp này.");
      await repository.createJoinRequest(classroom.class_id, userId, executor);
    },
    async cancelRequest(executor, requestId, classroomId, userId) {
      const result = await repository.cancelJoinRequest(requestId, classroomId, userId, executor);
      if (!result.rowCount) throw httpError(409, "Yêu cầu không còn chờ duyệt hoặc không thuộc về bạn. Danh sách lớp sẽ được cập nhật; nếu đã được duyệt, bạn có thể chọn rời lớp.");
    },
    async decideRequest(executor, requestId, classroomId, approve) {
      const { rows } = await repository.findPendingRequest(requestId, classroomId, executor);
      if (!rows[0]) throw httpError(409, "Yêu cầu đã được xử lý hoặc không thuộc lớp.");
      await repository.setRequestStatus(rows[0].request_id, approve ? "APPROVED" : "REJECTED", executor);
      if (approve) await repository.addMembership(classroomId, rows[0].student_id, executor);
      return rows[0];
    },
    async removeMember(executor, membershipId, classroomId) {
      return repository.removeMember(membershipId, classroomId, executor);
    },
    async leave(executor, classroomId, userId) {
      return repository.leave(classroomId, userId, executor);
    },
    async shareMaterials(executor, classroomId, ownerId, documentIds) {
      const unique = [...new Set(documentIds.map(String))];
      const docs = await repository.findShareableDocuments(unique, ownerId, executor);
      if (docs.rowCount !== unique.length) throw httpError(400, "Chỉ chia sẻ tài liệu của bạn đã được xử lý và chưa xóa.");
      let added = 0;
      for (const id of unique) added += (await repository.addMaterial(classroomId, id, executor)).rowCount;
      return { added, unique };
    },
    async unshareMaterial(executor, classroomId, documentId) {
      return repository.removeMaterial(classroomId, documentId, executor);
    },
    async deleteClass(executor, classroomId) {
      await repository.deleteCascade(classroomId, executor);
    },
    async lookup(code) {
      const joinCode = text(code, 20).toUpperCase();
      const classroom = await repository.findActiveByJoinCode(joinCode);
      if (!classroom) throw httpError(404, "Không tìm thấy lớp với mã này.");
      return classroom;
    },
    async create(teacherId, body) {
      const fields = classFields(body);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const classroom = await repository.create({
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
    },
  };
}
