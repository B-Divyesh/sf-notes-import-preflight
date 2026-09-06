import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "/work/.evidence/playwright-report", open: "never" }]],
  outputDir: "/work/.evidence/playwright-results",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "node scripts/serve-site.mjs",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: false,
    timeout: 20_000
  }
});
