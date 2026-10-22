import { Router } from "express";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation } from "../middlewares/auth.js";
import { createQuizController } from "../controllers/quizController.js";
import { validateQuestions } from "../validators/quizValidator.js";
import { authRateLimit } from "../middlewares/auth.js";

export function createQuizRouter({ authRepository = createAuthRepository(), ...options } = {}) {
	const router = Router();
	router.use(requireAuth(createAuthService(authRepository)));
	router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
	router.use((req, res, next) => req.method === "GET" || req.method === "HEAD" ? next() : protectAuthMutation(req, res, next));
	const controller = createQuizController(options);
	router.post("/generate", authRateLimit(30, 15 * 60_000), controller.generate);
	router.get("/", controller.list);
	router.get("/attempts", controller.listAttempts);
	router.post("/", controller.create);
	router.put("/:id", controller.update);
	router.delete("/:id", controller.remove);
	router.post("/:id/attempts", controller.startAttempt);
	router.post("/attempts/:id/submit", controller.submitAttempt);
	return router;
}

export { validateQuestions };
