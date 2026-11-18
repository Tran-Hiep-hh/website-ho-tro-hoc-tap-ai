// @ts-nocheck
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const server = createApp().listen(env.port, () => {
  console.log(`[SERVER] API URL: http://localhost:${env.port}`);
  console.log(`[CLIENT] URL: ${env.clientUrl}`);
});

const shutdown = (signal) => {
  console.log(`Nhận ${signal}, đang dừng máy chủ...`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

