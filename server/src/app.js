import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import apiRouter from "./routes/index.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createDocumentRouter } from "./routes/documentRoutes.js";
import { createQuizRouter } from "./routes/quizRoutes.js";
import { createStudyRouter } from "./routes/studyRoutes.js";
import { createClassRouter } from "./routes/classRoutes.js";
import { createAssignmentRouter } from "./routes/assignmentRoutes.js";

export function createApp({ authRepository, documentDatabase, documentStorageRoot } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/auth", createAuthRouter(authRepository));
  app.use("/api/documents", createDocumentRouter({ authRepository, database: documentDatabase, storageRoot: documentStorageRoot }));
  app.use("/api/quizzes", createQuizRouter({ authRepository, database: documentDatabase }));
  app.use("/api/study-materials", createStudyRouter({ authRepository, database: documentDatabase }));
  app.use("/api/classes", createClassRouter({ authRepository, database: documentDatabase }));
  app.use("/api/assignments", createAssignmentRouter({ authRepository, database: documentDatabase }));
  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
