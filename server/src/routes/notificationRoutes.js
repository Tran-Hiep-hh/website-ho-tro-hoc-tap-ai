import { Router } from "express";
import { pool } from "../config/database.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";

const validId = (id) => /^[1-9]\d{0,18}$/.test(String(id)) && BigInt(id) <= 9223372036854775807n;
export function createNotificationRouter({ database = pool, authRepository = createAuthRepository() } = {}) {
  const router = Router();
  router.use(requireAuth(createAuthService(authRepository)));
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.get("/", async (req, res) => {
    const { rows } = await database.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY notification_id DESC", [req.user.userId]);
    res.json({ success: true, notifications: rows.map((row) => ({ id: String(row.notification_id), title: row.title, text: row.body, route: row.route, icon: row.icon, read: row.is_read, date: row.created_at })) });
  });
  router.put("/read", protectAuthMutation, async (req, res) => {
    if (!validId(req.body?.throughId)) throw httpError(400, "Mốc thông báo không hợp lệ.");
    await database.query("UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND notification_id<=$2 AND NOT is_read", [req.user.userId, req.body.throughId]);
    res.json({ success: true });
  });
  router.put("/:id/read", protectAuthMutation, async (req, res) => {
    if (!validId(req.params.id)) throw httpError(404, "Không tìm thấy thông báo của bạn.");
    const result = await database.query("UPDATE notifications SET is_read=TRUE WHERE notification_id=$1 AND user_id=$2", [req.params.id, req.user.userId]);
    if (!result.rowCount) throw httpError(404, "Không tìm thấy thông báo của bạn.");
    res.json({ success: true });
  });
  return router;
}
