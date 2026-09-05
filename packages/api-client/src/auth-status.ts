// ─────────────────────────────────────────────────────────────────────────────
// auth-status.ts — 「/api/me 失败了，到底是没登录还是服务挂了」的判定（纯函数，可单测）。
//
// 背景（P1-8）：AuthProvider 早期把 `/api/me` 的**任何**异常都当成「没登录」，
// 于是后端一抖（502 / 504 / 网络断 / 反代返回 HTML 错误页），受保护页面就会
// 「跳账号中心 → 授权 → 回调 → /api/me 又失败 → 再跳」无限打转，用户看到的是
// 页面疯狂闪烁，令牌也被反复清掉。
//
// 规则：只有**确定的 401**（apiFetch 已经用 refresh token 重试过一次仍然 401）
// 才算「没登录」；其余一律算「服务暂时不可用」——保留令牌、进 error 态、给重试按钮。
//
// 「重试过一次」也包含**刷新那一步本身失败**的情形：换令牌的请求撞上断网 / 5xx / 超时，
// 此时 apiFetch 抛的是 `AUTH_REFRESH_UNAVAILABLE`（503），同样按「服务暂时不可用」处理 ——
// 账号中心抖一下不该把所有人的会话清掉。
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError, AUTH_REFRESH_UNAVAILABLE } from "./_client";

/**
 * 会话状态：
 *   - `loading`         首次拉取 / 重试中
 *   - `ready`           已拿到当前用户
 *   - `unauthenticated` 确认未登录（无令牌，或 401）
 *   - `error`           服务暂时不可用（网络 / 5xx / 坏响应）；令牌保留，可重试
 */
export type AuthStatus = "loading" | "ready" | "unauthenticated" | "error";

/**
 * 这个异常是否代表「确定没登录」。
 *
 * `apiFetch` 在 401 时（id 模式下已经单飞刷新并重放过一次）抛
 * `ApiError{code:"UNAUTHORIZED", status:401}`，那才是判定依据。
 * 注意**不能**只看 code —— 后端业务错误也可能叫 UNAUTHORIZED 但带别的状态码。
 */
export function isDefinitiveUnauthorized(e: unknown): boolean {
  // 刷新令牌那一步自己挂了（网络 / 5xx / 等锁超时）：令牌还在，谈不上「没登录」。
  if (isTransientAuthFailure(e)) return false;
  if (e instanceof ApiError) return e.status === 401;
  // 非 ApiError（TypeError: Failed to fetch、AbortError、超时…）一律不算「没登录」。
  return false;
}

/**
 * 这个异常是不是「刷新令牌时后端不可用」（P1-8 的暂时故障）。
 * 与 401 的区别：令牌**没有**被清掉，用户点重试就可能直接恢复。
 */
export function isTransientAuthFailure(e: unknown): boolean {
  return e instanceof ApiError && e.code === AUTH_REFRESH_UNAVAILABLE;
}

/** `/api/me` 失败时该进哪个状态。 */
export function statusForMeFailure(e: unknown): Extract<AuthStatus, "unauthenticated" | "error"> {
  return isDefinitiveUnauthorized(e) ? "unauthenticated" : "error";
}

/**
 * 是否应该发起登录跳转。
 * error 态**绝不**跳 —— 那正是死循环的入口（回调页刚跳回来 `/api/me` 就 502 时尤其致命）。
 */
export function shouldRedirectToLogin(input: {
  status: AuthStatus;
  hasUser: boolean;
  isPublicPath: boolean;
}): boolean {
  if (input.status !== "unauthenticated") return false;
  if (input.hasUser) return false;
  return !input.isPublicPath;
}

/** 是否应该用「服务暂时不可用」重试屏替换掉页面内容。 */
export function shouldRenderRetryScreen(input: { status: AuthStatus; isPublicPath: boolean }): boolean {
  return input.status === "error" && !input.isPublicPath;
}
