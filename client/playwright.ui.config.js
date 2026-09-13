import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["workspace.spec.js", "dashboard.spec.js"],
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/workspace",
  use: {
    baseURL: "http://localhost:5176",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node ../node_modules/vite/bin/vite.js --host localhost --port 5176 --strictPort",
    url: "http://localhost:5176",
    env: { VITE_API_URL: "/api" },
    reuseExistingServer: false,
  },
});
