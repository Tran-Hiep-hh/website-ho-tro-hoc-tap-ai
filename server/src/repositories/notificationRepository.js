import { pool } from "../config/database.js";

export function createNotificationRepository(database = pool) {
  return {
    async findByUserId(userId) {
      const { rows } = await database.query(
        "SELECT * FROM notifications WHERE user_id=$1 ORDER BY notification_id DESC",
        [userId],
      );
      return rows;
    },
    async markReadThrough(userId, notificationId) {
      await database.query(
        "UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND notification_id<=$2 AND NOT is_read",
        [userId, notificationId],
      );
    },
    async markRead(userId, notificationId) {
      const result = await database.query(
        "UPDATE notifications SET is_read=TRUE WHERE notification_id=$1 AND user_id=$2",
        [notificationId, userId],
      );
      return result.rowCount > 0;
    },
  };
}
