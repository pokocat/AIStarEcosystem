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
    // 浏览器存储：本机（Node 25）和 CI（Node 22）用同一种，每条用例前清空（见 vitest.setup.ts 头注释）
    setupFiles: ["./vitest.setup.ts"],
  },
});
