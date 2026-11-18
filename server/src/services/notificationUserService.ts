// @ts-nocheck
import { httpError } from "../utils/httpError.js";
import type { INotificationService } from "../interfaces/serviceInterfaces.js";
import type { INotificationRepository } from "../interfaces/repositoryInterfaces.js";

const validId = (value: unknown): boolean => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(String(value)) <= 9223372036854775807n;

const toNotification = (row: any) => ({
  id: String(row.notification_id),
  title: row.title,
  text: row.body,
  route: row.route,
  icon: row.icon,
  read: row.is_read,
  date: row.created_at,
});

export class NotificationUserService implements INotificationService {
  constructor(private readonly repository: INotificationRepository) {}

  async list(userId: string): Promise<unknown[]> {
    const rows = await this.repository.findByUserId(userId);
    return (rows as any[]).map(toNotification);
  }

  async markReadThrough(userId: string, notificationId: string): Promise<void> {
    if (!validId(notificationId)) throw httpError(400, "Mốc thông báo không hợp lệ.");
    await this.repository.markReadThrough(userId, notificationId);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    if (!validId(notificationId)) throw httpError(404, "Không tìm thấy thông báo của bạn.");
    if (!await this.repository.markRead(userId, notificationId)) {
      throw httpError(404, "Không tìm thấy thông báo của bạn.");
    }
  }
}

export function createNotificationUserService(repository: INotificationRepository): INotificationService {
  return new NotificationUserService(repository);
}
