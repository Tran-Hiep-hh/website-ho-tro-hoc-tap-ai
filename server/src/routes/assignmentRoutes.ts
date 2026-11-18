// @ts-nocheck
import { Router } from "express";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation } from "../middlewares/auth.js";
import { createAssignmentController } from "../controllers/assignmentController.js";
import type { IAuthRepository } from "../interfaces/repositoryInterfaces.js";
import type { Pool } from "pg";

export interface AssignmentRouterDependencies {
	authRepository?: IAuthRepository;
	database?: Pool;
	[key: string]: unknown;
}

export function createAssignmentRouter({ authRepository = createAuthRepository(), ...options }: AssignmentRouterDependencies = {}) {
	const router = Router();
	router.use(requireAuth(createAuthService(authRepository)));
	router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
	router.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : protectAuthMutation(req, res, next));
	const controller = createAssignmentController(options);
	router.get("/", controller.list);
	router.post("/", controller.create);
	router.put("/:id", controller.update);
	router.delete("/:id", controller.remove);
	router.post("/:id/status", controller.changeStatus);
	router.post("/:id/attempts", controller.startAttempt);
	router.put("/attempts/:id/answers", controller.saveAnswers);
	router.post("/attempts/:id/submit", controller.submitAttempt);
	return router;
}
