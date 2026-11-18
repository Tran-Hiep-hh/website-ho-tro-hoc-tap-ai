import { pool } from "../config/database.js";
import type { INotificationRepository } from "../interfaces/repositoryInterfaces.js";

export class NotificationRepository implements INotificationRepository {
  constructor(private readonly database: any = pool) {}

async findByUserId(userId) {
  const { rows } = await this.database.query(
    "SELECT * FROM notifications WHERE user_id=$1 ORDER BY notification_id DESC",
    [userId],
  );
  return rows;
}
async markReadThrough(userId, notificationId) {
  await this.database.query(
    "UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND notification_id<=$2 AND NOT is_read",
    [userId, notificationId],
  );
}
async markRead(userId, notificationId) {
  const result = await this.database.query(
    "UPDATE notifications SET is_read=TRUE WHERE notification_id=$1 AND user_id=$2",
    [notificationId, userId],
  );
  return result.rowCount > 0;
}
}

export function createNotificationRepository(database: any = pool): INotificationRepository {
  return new NotificationRepository(database);
}
