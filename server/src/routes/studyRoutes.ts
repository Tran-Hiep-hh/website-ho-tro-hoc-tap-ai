// @ts-nocheck
import { Router } from "express";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation } from "../middlewares/auth.js";
import { createStudyController } from "../controllers/studyController.js";
import { validateCards, validateNodes } from "../validators/studyValidator.js";
import { authRateLimit } from "../middlewares/auth.js";
import type { IAuthRepository } from "../interfaces/repositoryInterfaces.js";
import type { Pool } from "pg";

export interface StudyRouterDependencies {
	authRepository?: IAuthRepository;
	database?: Pool;
	[key: string]: unknown;
}

export function createStudyRouter({ authRepository = createAuthRepository(), ...options }: StudyRouterDependencies = {}) {
	const router = Router();
	router.use(requireAuth(createAuthService(authRepository)));
	router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
	router.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : protectAuthMutation(req, res, next));
	const controller = createStudyController(options);
	router.get("/", controller.list);
	router.post("/generate", authRateLimit(30, 15 * 60_000), controller.generate);
	router.post("/", controller.create);
	router.put("/:id", controller.update);
	router.put("/:id/progress", controller.updateProgress);
	router.delete("/:id", controller.remove);
	return router;
}

export { validateCards, validateNodes };
