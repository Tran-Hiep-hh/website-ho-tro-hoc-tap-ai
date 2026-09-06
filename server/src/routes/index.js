import { Router } from "express";
import { getDatabaseHealth, getHealth } from "../controllers/healthController.js";

const router = Router();

router.get("/health", getHealth);
router.get("/health/database", getDatabaseHealth);

export default router;
