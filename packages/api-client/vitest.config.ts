import { defineConfig } from "vitest/config";

// api-client 单元测试（v0.149 / 统一账号中心 P2）。
// 只覆盖 oidc.ts 的纯函数与单飞刷新 —— 不引 jsdom：被测代码只碰
// `window.localStorage` / `window.sessionStorage` / `window.location`，
// 测试用例自己按需装最小 shim，比整套 DOM 更能暴露越界访问。
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    env: {
      NEXT_PUBLIC_ID_ISSUER: "https://id.example.com",
      NEXT_PUBLIC_ID_CLIENT_ID: "web-test",
    },
  },
});
