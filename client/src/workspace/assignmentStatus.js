export function assignmentStatus(item, now = Date.now()) {
  if (item.status === "DRAFT") return ["Bản nháp", "gray"];
  if (item.status === "CANCELLED") return ["Đã hủy", "gray"];
  if (new Date(item.dueAt).getTime() <= now) return ["Đã kết thúc", "gray"];
  if (new Date(item.startAt).getTime() > now) return ["Sắp mở", "blue"];
  return ["Đang mở", "green"];
}

export function studentAssignmentStatus(item, attempts = [], now = Date.now()) {
  const status = assignmentStatus(item, now);
  if (status[0] !== "Đang mở") return status;
  if (item.inProgress) return ["Đang làm", "blue"];
  const used = item.attemptsUsed ?? attempts.filter((attempt) => attempt.assignmentId === item.id).length;
  return used >= item.maxAttempts ? ["Đã hết lượt làm", "gray"] : status;
}
