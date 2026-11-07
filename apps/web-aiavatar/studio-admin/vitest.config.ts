import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // 默认 5 秒、不限进程数时，pnpm test:all 同时跑全部项目，CI 和高负载的本机上会出现超时假失败。和 web-aiavatar 同一套设置，见它的 vitest.config.ts。
  test: { environment: "jsdom", maxWorkers: "50%", minWorkers: 1, testTimeout: 15_000, setupFiles: ["./src/test/setup.ts"], css: false },
});
