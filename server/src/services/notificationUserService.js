import { httpError } from "../utils/httpError.js";

const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

const toNotification = (row) => ({
  id: String(row.notification_id),
  title: row.title,
  text: row.body,
  route: row.route,
  icon: row.icon,
  read: row.is_read,
  date: row.created_at,
});

export function createNotificationUserService(repository) {
  return {
    async list(userId) {
      return (await repository.findByUserId(userId)).map(toNotification);
    },
    async markReadThrough(userId, notificationId) {
      if (!validId(notificationId)) throw httpError(400, "Mốc thông báo không hợp lệ.");
      await repository.markReadThrough(userId, notificationId);
    },
    async markRead(userId, notificationId) {
      if (!validId(notificationId)) throw httpError(404, "Không tìm thấy thông báo của bạn.");
      if (!await repository.markRead(userId, notificationId)) {
        throw httpError(404, "Không tìm thấy thông báo của bạn.");
      }
    },
  };
}
