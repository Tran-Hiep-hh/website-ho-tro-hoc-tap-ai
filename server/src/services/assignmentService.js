import { httpError } from "../utils/httpError.js";
import { withTransaction } from "../repositories/withTransaction.js";

const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;
const missing = () => httpError(404, "Không tìm thấy bài giao hoặc bạn không có quyền truy cập.");

export function createAssignmentService(repository, database) {
  return {
    async runInTransaction(work) {
      return withTransaction(database, work);
    },
    async classAccess(executor, user, classId, own = false) {
      if (!validId(classId)) throw missing();
      const { rows } = await repository.findActiveClass(classId, executor);
      const classroom = rows[0];
      if (!classroom) throw missing();
      if (own) {
        if (user.role !== "TEACHER") throw httpError(403, "Chỉ giáo viên được giao Quiz.");
        if (String(classroom.teacher_id) !== String(user.userId)) throw missing();
      } else {
        if (user.role !== "STUDENT") throw httpError(403, "Chỉ học sinh được làm bài giao.");
        const member = await repository.findActiveMember(classId, user.userId, executor);
        if (!member.rowCount) throw missing();
      }
      return classroom;
    },
    async access(executor, user, assignmentId, own = false) {
      if (!validId(assignmentId)) throw missing();
      const lookup = await repository.findAssignmentClass(assignmentId, executor);
      if (!lookup.rowCount) throw missing();
      await this.classAccess(executor, user, lookup.rows[0].class_id, own);
      const { rows } = await repository.findAssignment(assignmentId, executor);
      return rows[0];
    },
  };
}
