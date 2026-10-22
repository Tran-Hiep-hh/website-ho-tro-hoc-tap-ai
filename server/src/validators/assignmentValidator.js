import { httpError } from "../utils/httpError.js";
import { text } from "./quizValidator.js";

const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

function validateSchedule(body = {}, includeQuestions = false) {
  const start = new Date(body.startAt);
  const due = new Date(body.dueAt);
  const duration = body.durationMinutes ?? null;
  if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) {
    throw httpError(400, "Thời gian làm bài phải là số nguyên từ 1 đến 1440 phút.");
  }
  if (
    typeof body.title !== "string" || !body.title.trim() || body.title.length > 150 || body.title.includes("\0")
    || !Number.isFinite(start.getTime()) || !Number.isFinite(due.getTime()) || due <= start
    || (includeQuestions && !validId(body.versionId))
    || !Number.isInteger(body.maxAttempts) || body.maxAttempts < 1 || body.maxAttempts > 10
    || typeof body.showAnswers !== "boolean"
  ) {
    throw httpError(400, includeQuestions ? "Kiểm tra tên bài, lịch, số lượt và thời gian làm bài." : "Thiết lập bài giao không hợp lệ. Kiểm tra tên, lịch và số lượt 1–10.");
  }
  return { title: body.title.trim(), start, due, duration };
}

export function validateCreateAssignment(body = {}) {
  if (!validId(body.classId) || !validId(body.contentId) || !validId(body.versionId) || !["DRAFT", "PUBLISHED"].includes(body.status)) {
    throw httpError(400, "Thiết lập bài giao không hợp lệ. Kiểm tra tên, lịch và số lượt 1–10.");
  }
  const schedule = validateSchedule(body);
  if (schedule.due.getTime() <= Date.now()) throw httpError(400, "Thiết lập bài giao không hợp lệ. Kiểm tra tên, lịch và số lượt 1–10.");
  return schedule;
}

export function validateUpdateAssignment(body = {}) {
  return { ...validateSchedule(body, true), questions: body.questions };
}

export { validId };
