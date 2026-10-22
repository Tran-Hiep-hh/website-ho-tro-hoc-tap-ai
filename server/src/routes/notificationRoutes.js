import { Router } from "express";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createNotificationRepository } from "../repositories/notificationRepository.js";
import { createAuthService } from "../services/authService.js";
import { createNotificationUserService } from "../services/notificationUserService.js";
import { requireAuth, protectAuthMutation } from "../middlewares/auth.js";
import { createNotificationController } from "../controllers/notificationController.js";

export function createNotificationRouter({ database, authRepository = createAuthRepository(), notificationRepository = createNotificationRepository(database) } = {}) {
	const router = Router();
	const authService = createAuthService(authRepository);
	const controller = createNotificationController(createNotificationUserService(notificationRepository));
	router.use(requireAuth(authService));
	router.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });
	router.get("/", controller.list);
	router.put("/read", protectAuthMutation, controller.markReadThrough);
	router.put("/:id/read", protectAuthMutation, controller.markRead);
	return router;
}
