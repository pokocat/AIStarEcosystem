// ─────────────────────────────────────────────────────────────────────────────
// config.ts — 前端运行期开关（mock / dev 入口 / 后端地址 / 登录模式）。
//
// 单独成文件的原因：`oidc.ts` 与 `_client.ts` 互相引用（apiFetch 401 要刷新令牌，
// 刷新令牌要写令牌仓库），把常量放在两者共同的下游模块可以避免循环 import 在模块
// 初始化期读到 undefined。`_client.ts` 仍然 re-export 这些名字，老调用方不受影响。
//
// ⚠️ Next 在构建期用字面量替换 `process.env.NEXT_PUBLIC_*`，因此这里必须写全名，
// 不能用变量拼接。
// ─────────────────────────────────────────────────────────────────────────────

/** 当 NEXT_PUBLIC_USE_MOCK=1 时，API 层直接返回 mocks/ 目录中的静态数据。 */
export const USE_MOCK: boolean =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCK === "1";

/** dev-login 入口：生产构建默认隐藏；联调环境可用 NEXT_PUBLIC_ENABLE_DEV_LOGIN=1 显式打开。 */
export const ENABLE_DEV_LOGIN: boolean =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1" ||
    (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "0" &&
      process.env.NODE_ENV !== "production"));

/** 后端基础地址，默认 /api（同域反向代理），可通过环境变量覆盖。 */
export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "/api";

/**
 * 登录模式（docs/unified-identity-plan.md §12.5）：
 *   - `legacy`：本仓 server 自己发短信码 / 签 HS256 令牌（历史行为）。
 *   - `id`：统一账号中心（id.aibuzz.cn）OIDC 授权码 + PKCE。
 *
 * 判定：显式 `NEXT_PUBLIC_AUTH_MODE` 优先；否则「配了 issuer 即 id」。
 *
 * **USE_MOCK=1 一律回落 legacy** —— mock 模式没有账号中心可跳，且规划文档明确要求
 * 「USE_MOCK 与 legacy 现有流程完全不变」。
 */
export const ID_ISSUER_RAW: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ID_ISSUER) || "";

const AUTH_MODE_RAW: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_MODE) || "";

const ID_CLIENT_ID_RAW: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ID_CLIENT_ID) || "";

export type AuthMode = "id" | "legacy";

export function authMode(): AuthMode {
  if (USE_MOCK) return "legacy";
  if (AUTH_MODE_RAW === "id") return "id";
  if (AUTH_MODE_RAW === "legacy") return "legacy";
  return ID_ISSUER_RAW ? "id" : "legacy";
}

/** 账号中心 issuer（无尾斜杠）。未配置返回空串。 */
export function idIssuer(): string {
  return ID_ISSUER_RAW.replace(/\/+$/, "");
}

/** 本 app 在账号中心注册的 client_id；dev 统一 `web-dev`。 */
export function idClientId(): string {
  return ID_CLIENT_ID_RAW || "web-dev";
}

/** 便捷判定：当前是否走统一账号中心登录。 */
export function isIdMode(): boolean {
  return authMode() === "id";
}
