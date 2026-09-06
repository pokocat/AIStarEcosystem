import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// web-ipstudio 单元测试配置。
// 目前只测纯逻辑（lib/graph 的上游遍历与输入闸门 —— 这里错了整套内置工作流都跑不起来），
// 所以用 node 环境、不引 jsdom；JSX 由 esbuild 的 automatic runtime 转译。
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
