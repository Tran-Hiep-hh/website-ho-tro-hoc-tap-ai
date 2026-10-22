import { Router } from "express";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { authRateLimit, requireAuth, protectAuthMutation } from "../middlewares/auth.js";
import { createClassController } from "../controllers/classController.js";

export function createClassRouter({ authRepository = createAuthRepository(), ...options } = {}) {
	const router = Router();
	router.use(requireAuth(createAuthService(authRepository)));
	router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
	router.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : protectAuthMutation(req, res, next));
	const controller = createClassController(options);
	router.get("/", controller.list);
	router.post("/lookup", authRateLimit(30, 15 * 60_000), controller.lookup);
	router.post("/", controller.create);
	router.put("/:id", controller.update);
	router.post("/:id/join", authRateLimit(30, 15 * 60_000), controller.join);
	router.delete("/:id/requests/:requestId", controller.cancelRequest);
	router.post("/:id/requests/:requestId", controller.decideRequest);
	router.delete("/:id/members/:memberId", controller.removeMember);
	router.post("/:id/leave", controller.leave);
	router.post("/:id/materials", controller.shareMaterials);
	router.delete("/:id/materials/:documentId", controller.unshareMaterial);
	router.delete("/:id", controller.remove);
	return router;
}
