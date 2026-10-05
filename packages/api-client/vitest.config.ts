import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// api-client 单元测试（v0.149 / 统一账号中心 P2）。
// 只覆盖 oidc.ts 的纯函数与单飞刷新 —— 不引 jsdom：被测代码只碰
// `window.localStorage` / `window.sessionStorage` / `window.location`，
// 测试用例自己按需装最小 shim，比整套 DOM 更能暴露越界访问。
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    // 「全局没有 Storage」要在本机也成立：Node 25 自带 localStorage / sessionStorage 全局，Node 22（CI）没有，
    // 这里把本机那两个删掉，测试自己装的 shim 才是唯一来源（见 scripts/vitest/setup-storage.ts 文件头注释）
    setupFiles: [resolve(__dirname, "../../scripts/vitest/setup-storage.ts")],
    env: {
      NEXT_PUBLIC_ID_ISSUER: "https://id.example.com",
      NEXT_PUBLIC_ID_CLIENT_ID: "web-test",
    },
  },
});
