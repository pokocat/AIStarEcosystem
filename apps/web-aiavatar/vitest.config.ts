import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// AI IP 工作台（画布）单元测试配置 —— v0.190 随 web-ipstudio 并入本 app 时一起搬来。
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
    // 大多是纯逻辑（node 就够）；要 DOM 的文件在第一行写 `// @vitest-environment jsdom`。
    environment: "node",
    // jsdom 文件每个都要建一个浏览器环境、再加载 antd / 画布模块，纯 CPU。默认开「核数 - 1」个进程时，
    // 测试自己就把 10 核机器的负载顶到 110 以上，单条用例从 0.3 秒被拖到 10 秒、报 5 秒超时的假失败；
    // 限到一半核数，墙钟不变、CPU 减半、假失败归零（2026-10-20 实测，见 docs/audits/web-aiavatar-test-suite-audit-2026-10.md）。
    maxWorkers: "50%",
    minWorkers: 1,
    // 剩下那点争用（和开发服务器、浏览器脚本同机跑）仍会把首条用例拖过 5 秒；放宽到 15 秒只让慢变成慢、不变成红，
    // 真卡死的用例照样会超时失败。
    testTimeout: 15_000,
    // 本机 Node 25 和 CI 的 Node 22 看到的 Web Storage 不一样：jsdom 文件里要能用、node 环境里要「没有」
    // （全仓共用一份，见 scripts/vitest/setup-storage.ts 文件头注释）
    setupFiles: [resolve(__dirname, "../../scripts/vitest/setup-storage.ts")],
  },
});
