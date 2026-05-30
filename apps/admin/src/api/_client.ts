// ─────────────────────────────────────────────────────────────────────────────
// _client.ts — Admin 后台 API 调用底座。
// 通过 NEXT_PUBLIC_USE_MOCK=1 切换为仅使用 mocks/ 数据（无网络）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiResponse, ApiErrorShape } from "@/types/_shared";
import { emitGlobalError } from "@/lib/global-errors";

/** 当 NEXT_PUBLIC_USE_MOCK=1 时，API 层直接返回 mocks/ 目录中的静态数据。 */
export const USE_MOCK: boolean =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_MOCK === "1";

/** 后端基础地址，默认 /api（同域反向代理），可通过环境变量覆盖。 */
export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "/api";

/** Admin JWT 存储键。生产模式下后端只认 Authorization: Bearer <token>。 */
export const AUTH_TOKEN_KEY = "aistareco.admin.auth.token";

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
    /* localStorage 不可用时保持请求失败语义 */
  }
}

function loginUrl(): string {
  if (typeof window === "undefined") return "/admin/login";
  const { pathname, search } = window.location;
  const base = pathname.startsWith("/admin") ? "/admin" : "";
  if (pathname === `${base}/login`) return `${base}/login`;
  const next = `${pathname}${search}`;
  return `${base}/login?next=${encodeURIComponent(next)}`;
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

function reportApiError(error: ApiError, path: string) {
  emitGlobalError({
    title: error.status === 401 ? "登录状态异常" : "接口请求失败",
    description: error.message,
    source: `${path}${error.code ? ` · ${error.code}` : ""}`,
    fingerprint: `api:${path}:${error.status ?? "network"}:${error.code}:${error.message}`,
  });
}

function throwApiError(error: ApiError, path: string): never {
  reportApiError(error, path);
  throw error;
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

  // v0.34+: FormData 支持 multipart 上传（不设 Content-Type，让浏览器自动加 boundary）
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers || {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
      signal,
      credentials: "include",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throwApiError(
      new ApiError(
        {
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : "网络请求失败",
        },
        undefined,
      ),
      path,
    );
  }

  if (res.status === 401) {
    setAuthToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.endsWith("/login")) {
      window.location.assign(loginUrl());
    }
    throwApiError(
      new ApiError(
        { code: "UNAUTHORIZED", message: "登录状态无效或已过期" },
        res.status,
      ),
      path,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let parsed: unknown;
  let rawBody = "";
  try {
    rawBody = await res.text();
    parsed = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    throwApiError(
      new ApiError(
        { code: "PARSE_ERROR", message: `Invalid JSON from ${path}` },
        res.status,
      ),
      path,
    );
  }

  if (!rawBody && res.ok) {
    return undefined as T;
  }

  if (!res.ok) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "HTTP_ERROR",
      message: `HTTP ${res.status}`,
    };
    throwApiError(new ApiError(err, res.status), path);
  }

  const envelope = parsed as ApiResponse<T>;
  if (!envelope || envelope.success !== true) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "BAD_ENVELOPE",
      message: "Response envelope missing success:true",
    };
    throwApiError(new ApiError(err, res.status), path);
  }
  return envelope.data;
}

/** Mock 延迟，模拟真实网络抖动。 */
export function mockDelay<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}
