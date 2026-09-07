import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// web-ipstudio 单元测试配置。
//
// 测的是 **canvas-bridge**：画布本身是搬来的（src/canvas，见那儿的 README），
// 不是我们的代码；我们的逻辑全在胶水层 —— 图存 OSS、生成调服务端、
// 项目与服务端同步。那几处出错的表现都很隐蔽（图重复上传、签名过期后图裂、
// 加载没完就把服务端内容覆盖成空），所以要有测试盯着。
//
// node 环境、不引 jsdom；JSX 由 esbuild 的 automatic runtime 转译。
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  esbuild: { jsx: "automatic" },
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    // 大多是纯逻辑（node 就够）；project-sync 测的是 React hook，那一份要 DOM。
    environmentMatchGlobs: [["**/project-sync.test.ts", "jsdom"]],
    environment: "node",
  },
});
