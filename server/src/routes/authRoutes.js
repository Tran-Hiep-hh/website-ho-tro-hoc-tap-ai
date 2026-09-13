import { Router } from "express";
import { createAuthController } from "../controllers/authController.js";
import { authRateLimit, protectAuthMutation, requireAuth } from "../middlewares/auth.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";

export function createAuthRouter(repository = createAuthRepository()) {
  const router = Router();
  const service = createAuthService(repository);
  const controller = createAuthController(service);
  router.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });
  router.post("/register", protectAuthMutation, authRateLimit(20, 15 * 60_000), controller.register);
  router.post("/login", protectAuthMutation, authRateLimit(30, 15 * 60_000), controller.login);
  router.post("/refresh", protectAuthMutation, authRateLimit(120, 60_000), controller.refresh);
  router.post("/logout", protectAuthMutation, controller.logout);
  router.get("/me", requireAuth(service), controller.me);
  router.put("/profile", protectAuthMutation, requireAuth(service), controller.updateProfile);
  router.post("/password", protectAuthMutation, requireAuth(service), authRateLimit(10, 15 * 60_000), controller.changePassword);
  return router;
}
