import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const schema = `auth_e2e_${randomUUID().replaceAll("-", "")}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["auth.spec.js", "documents.spec.js"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  metadata: { e2eSchema: schema },
  globalTeardown: "./e2e/teardown.js",
  use: {
    baseURL: "http://localhost:5175",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node scripts/auth-e2e-server.js",
      cwd: fileURLToPath(new URL("../server", import.meta.url)),
      url: "http://127.0.0.1:4015/api/health",
      env: { NODE_ENV: "test", PORT: "4015", CLIENT_URL: "http://localhost:5175", AUTH_E2E_SCHEMA: schema },
      reuseExistingServer: false,
    },
    {
      command: "node ../node_modules/vite/bin/vite.js --host localhost --port 5175 --strictPort",
      url: "http://localhost:5175",
      env: { VITE_PROXY_TARGET: "http://127.0.0.1:4015", VITE_API_URL: "/api" },
      reuseExistingServer: false,
    },
  ],
});
