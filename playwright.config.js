import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const testData = mkdtempSync(join(tmpdir(), "rr4-e2e-"));
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3101",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: `node server/index.js`,
    env: {
      DATA_DIR: testData,
      PORT: "3101",
      VK_ACCESS_TOKEN: "",
      ALLOW_DEMO_DATA: "1",
    },
    url: "http://127.0.0.1:3101/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
