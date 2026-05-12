// ─────────────────────────────────────────────────────────────────────────────
// _client.ts — 前端 API 调用底座。
// 通过 NEXT_PUBLIC_USE_MOCK=1 切换为仅使用 mocks/ 数据（无网络）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiResponse, ApiErrorShape } from "@ai-star-eco/types/_shared";

// TODO(cross-subdomain SSO)：当前 token 写 localStorage，仅本子域可见。
// 三个新 web app 部署到 music/drama/celebrity.aistar.com 后需改写入 cookie
// 并由后端把 Set-Cookie 的 Domain 设为 .aistar.com。改造点：
//   - getAuthToken / setAuthToken 改读写 document.cookie
//   - apiFetch 移除 Authorization header（cookie 由浏览器自动带上）
//   - server 端 SecurityConfig 启用 cookie 鉴权
//   - server 端 Set-Cookie 写 Domain=.aistar.com; SameSite=Lax

/** 当 NEXT_PUBLIC_USE_MOCK=1 时，API 层直接返回 mocks/ 目录中的静态数据。 */
export const USE_MOCK: boolean =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_MOCK === "1";

/** 后端基础地址，默认 /api（同域反向代理），可通过环境变量覆盖。 */
export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "/api";

/** JWT 存储的 localStorage 键名。 */
export const AUTH_TOKEN_KEY = "aistareco.auth.token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* 隐私模式 / storage 满，静默失败 */
  }
}

/** 401 回调——由 AuthContext 注册，用于把用户踢回 /login。 */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
export function registerUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  unauthorizedHandler = fn;
}

export class ApiError extends Error {
  code: string;
  details?: unknown;
  status?: number;
  constructor(shape: ApiErrorShape, status?: number) {
    super(shape.message);
    this.code = shape.code;
    this.details = shape.details;
    this.status = status;
  }
}

/** 构造 URL 查询串，自动过滤 undefined / null。 */
export function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * 发起后端请求，解包标准 ApiResponse<T> 壳为 T。
 * 约定后端响应：{ success: true, data: T } 或 { success: false, error: {code, message} }
 */
export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query, headers, signal } = opts;
  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  const token = getAuthToken();
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: "include",
  });

  if (res.status === 401) {
    setAuthToken(null);
    unauthorizedHandler?.();
    throw new ApiError({ code: "UNAUTHORIZED", message: "未登录或登录已失效" }, 401);
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new ApiError(
      { code: "PARSE_ERROR", message: `Invalid JSON from ${path}` },
      res.status
    );
  }

  if (!res.ok) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "HTTP_ERROR",
      message: `HTTP ${res.status}`,
    };
    throw new ApiError(err, res.status);
  }

  const envelope = parsed as ApiResponse<T>;
  if (!envelope || envelope.success !== true) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "BAD_ENVELOPE",
      message: "Response envelope missing success:true",
    };
    throw new ApiError(err, res.status);
  }
  return envelope.data;
}

/** Mock 延迟，模拟真实网络抖动。 */
export function mockDelay<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}
