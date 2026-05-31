import { defineConfig, devices } from "@playwright/test";

// E2E：在 NEXT_PUBLIC_USE_MOCK=1（全 mock，可离线）下跑两条创建路径从新建到入库归档。
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3013",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // 不由 Playwright 托管服务（避免端口竞态）：先 `NEXT_PUBLIC_USE_MOCK=1 pnpm dev` 起 :3013，再跑 e2e。
});
