import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// web-drama 单元测试配置（v0.67 / D-6）。
// 真后端落地后建立的首个测试基线 —— 聚焦纯逻辑（format / cast-derive）与
// client-side cache（drama-query）。jsdom 环境支撑 RTL renderHook；JSX 由
// esbuild 的 automatic runtime 转译（不引 @vitejs/plugin-react，避开 vite8 peer）。
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    // 默认 5 秒、不限进程数时，pnpm test:all 同时跑全部项目，CI 和高负载的本机上会出现超时假失败。和 web-aiavatar 同一套设置，见它的 vitest.config.ts。
    maxWorkers: "50%",
    minWorkers: 1,
    testTimeout: 15_000,
    // 本机 Node 25 的 localStorage 是个不能用的空壳、CI 的 Node 22 是 jsdom 真的 Storage：统一成能用的
    // （全仓共用一份，见 scripts/vitest/setup-storage.ts 文件头注释）
    setupFiles: [resolve(__dirname, "../../scripts/vitest/setup-storage.ts")],
  },
});
