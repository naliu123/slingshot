import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./qa",
  testMatch: "*.spec.cjs",
  timeout: 120_000,
  workers: 1,
  reporter: "list",
  outputDir: path.join(os.tmpdir(), "slingshot-playwright-results"),
  use: {
    baseURL: process.env.QA_BASE_URL ?? "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--disable-accelerated-2d-canvas"],
    },
  },
  webServer: {
    command: "npm run build && npm run start -- --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: process.env.QA_REUSE_SERVER === "1" || !process.env.CI,
    timeout: 120_000,
  },
});
