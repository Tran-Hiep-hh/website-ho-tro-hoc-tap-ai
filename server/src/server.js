import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`API đang chạy tại http://localhost:${env.port}`);
});

const shutdown = (signal) => {
  console.log(`Nhận ${signal}, đang dừng máy chủ...`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
