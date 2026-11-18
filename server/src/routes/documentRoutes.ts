// @ts-nocheck
import multer from "multer";
import { Router } from "express";
import { env } from "../config/env.js";
import { pool } from "../config/database.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createDocumentRepository } from "../repositories/documentRepository.js";
import { createAuthService } from "../services/authService.js";
import { createDocumentService } from "../services/documentService.js";
import { createDocumentController } from "../controllers/documentController.js";
import { requireAuth, authRateLimit } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IAuthRepository, IDocumentRepository } from "../interfaces/repositoryInterfaces.js";
import type { Pool } from "pg";

const defaultRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)), env.uploadDir);

export interface DocumentRouterDependencies {
	database?: Pool;
	authRepository?: IAuthRepository;
	documentRepository?: IDocumentRepository;
	storageRoot?: string;
}

export function createDocumentRouter({ database = pool, authRepository = createAuthRepository(), documentRepository, storageRoot = defaultRoot }: DocumentRouterDependencies = {}) {
	const router = Router();
	const service = createDocumentService({ database, repository: documentRepository ?? createDocumentRepository(database), storageRoot, maxFileSizeMb: env.maxFileSizeMb });
	const controller = createDocumentController({ documentService: service });
	const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 1, fields: 0 } }).single("file");
	router.use(requireAuth(createAuthService(authRepository)));
	router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
	router.get("/", controller.list);
	router.post("/", authRateLimit(30, 15 * 60_000), (req, res, next) => upload(req, res, (error) => next(error ? httpError(400, `Chỉ tải một tệp PDF, DOCX hoặc TXT, tối đa ${env.maxFileSizeMb} MB.`) : undefined)), controller.upload);
	router.get("/:id", controller.get);
	router.get("/:id/download", controller.download);
	router.delete("/:id", controller.remove);
	return router;
}
