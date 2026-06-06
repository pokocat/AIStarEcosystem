// ─────────────────────────────────────────────────────────────────────────────
// _client.ts — 前端 API 调用底座。
// 通过 NEXT_PUBLIC_USE_MOCK=1 切换为仅使用 mocks/ 数据（无网络）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiResponse, ApiErrorShape } from "@ai-star-eco/types/_shared";
import { findMockHandler, type MockMethod } from "./_mock-registry";

// TODO(cross-subdomain SSO)：当前 token 写 localStorage，仅本子域可见。
// 三个新 web app 部署到 music/drama/celebrity.aibuzz.cn 后需改写入 cookie
// 并由后端把 Set-Cookie 的 Domain 设为 .aibuzz.cn。改造点：
//   - getAuthToken / setAuthToken 改读写 document.cookie
//   - apiFetch 移除 Authorization header（cookie 由浏览器自动带上）
//   - server 端 SecurityConfig 启用 cookie 鉴权
//   - server 端 Set-Cookie 写 Domain=.aibuzz.cn; SameSite=Lax

/** 当 NEXT_PUBLIC_USE_MOCK=1 时，API 层直接返回 mocks/ 目录中的静态数据。 */
export const USE_MOCK: boolean =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_MOCK === "1";

/** dev-login 入口：生产构建默认隐藏；联调环境可用 NEXT_PUBLIC_ENABLE_DEV_LOGIN=1 显式打开。 */
export const ENABLE_DEV_LOGIN: boolean =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "1" ||
    (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "0" &&
      process.env.NODE_ENV !== "production"));

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

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const GLOBAL_API_ERROR_EVENT = "aistareco:api-error";

export type GlobalApiErrorEventDetail = {
  error: ApiError;
  path: string;
  method: HttpMethod;
  status?: number;
};

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
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  suppressParseErrorLog?: boolean;
  suppressGlobalError?: boolean;
}

function dispatchGlobalApiError(
  error: ApiError,
  context: { path: string; method: HttpMethod; suppressGlobalError?: boolean },
) {
  if (context.suppressGlobalError || typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<GlobalApiErrorEventDetail>(GLOBAL_API_ERROR_EVENT, {
        detail: {
          error,
          path: context.path,
          method: context.method,
          status: error.status,
        },
      }),
    );
  } catch {
    /* old browsers / test runtimes: global UI is best effort */
  }
}

function throwApiError(
  error: ApiError,
  context: { path: string; method: HttpMethod; suppressGlobalError?: boolean },
): never {
  dispatchGlobalApiError(error, context);
  throw error;
}

/**
 * 发起后端请求，解包标准 ApiResponse<T> 壳为 T。
 * 约定后端响应：{ success: true, data: T } 或 { success: false, error: {code, message} }
 */
export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    headers,
    signal,
    suppressParseErrorLog = false,
    suppressGlobalError = false,
  } = opts;

  // USE_MOCK：在网络层拦截，命中 registry 直接返回 handler 结果（已是 unwrapped T）。
  // handler 抛 ApiError 即可模拟错误。未注册路径会落到下方网络分支（dev 期可见 404，便于发现缺口）。
  if (USE_MOCK) {
    const match = findMockHandler(method as MockMethod, path);
    if (match) {
      try {
        return (await match.handler({ params: match.params, query, body })) as T;
      } catch (error) {
        if (error instanceof ApiError) {
          dispatchGlobalApiError(error, { path, method, suppressGlobalError });
        }
        throw error;
      }
    }
  }

  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(url, {
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
  } catch (error) {
    if ((error as { name?: unknown })?.name === "AbortError") throw error;
    throwApiError(
      new ApiError({ code: "NETWORK_ERROR", message: "网络请求失败，请检查网络后重试" }),
      { path, method, suppressGlobalError },
    );
  }

  if (res.status === 401) {
    setAuthToken(null);
    unauthorizedHandler?.();
    throwApiError(
      new ApiError({ code: "UNAUTHORIZED", message: "未登录或登录已失效" }, 401),
      { path, method, suppressGlobalError },
    );
  }

  const raw = await res.text();
  if (!raw) {
    if (!res.ok) {
      throwApiError(
        new ApiError({ code: "HTTP_ERROR", message: `HTTP ${res.status}` }, res.status),
        { path, method, suppressGlobalError },
      );
    }
    if (res.status !== 204 && res.status !== 205) {
      throwApiError(
        new ApiError(
          { code: "BAD_ENVELOPE", message: "Response envelope missing success:true" },
          res.status,
        ),
        { path, method, suppressGlobalError },
      );
    }
    return undefined as T;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 把 body 前 240 字符贴出来，方便排查 —— 否则只看到 "Invalid JSON" 一句
    // 啥也定位不了（HTML 错误页 / Next 代理 504 / sau timeout / 空体 等都会
    // 触发同一句）。
    const snippet = raw.length > 240 ? raw.slice(0, 240) + "…" : raw;
    const contentType = res.headers.get("content-type") ?? "<missing>";
    if (!suppressParseErrorLog && typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(
        `[apiFetch] non-JSON body from ${path}  status=${res.status}  ` +
          `content-type=${contentType}\n` +
          snippet,
      );
    }
    throwApiError(
      new ApiError(
        {
          code: "PARSE_ERROR",
          message:
            `服务器返回了非标准错误响应：${path}（HTTP ${res.status}，${contentType}）。` +
            `响应内容：${snippet || "<empty>"}`,
        },
        res.status,
      ),
      { path, method, suppressGlobalError },
    );
  }

  if (!res.ok) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "HTTP_ERROR",
      message: `HTTP ${res.status}`,
    };
    throwApiError(new ApiError(err, res.status), { path, method, suppressGlobalError });
  }

  const envelope = parsed as ApiResponse<T>;
  if (!envelope || envelope.success !== true) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "BAD_ENVELOPE",
      message: "Response envelope missing success:true",
    };
    throwApiError(new ApiError(err, res.status), { path, method, suppressGlobalError });
  }
  return envelope.data;
}

/** Mock 延迟，模拟真实网络抖动。 */
export function mockDelay<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/**
 * v0.22: 与 `apiFetch` 同形，但保留 PageEnvelope 的 `pagination` 元数据。
 *
 * 后端 `PageEnvelope<T>` 形状 `{ success, data: T[], pagination, message? }` —
 * `apiFetch` 只剥出 `data` 数组，丢掉 pagination；分页 UI 需要 `total / hasNext`
 * 这类元数据，所以这里单开一个 helper 把整张信封返回。
 *
 * 与 `apiFetch` 共用同一套 mock / 401 / parse 错误处理。
 */
import type { PaginatedResponse } from "@ai-star-eco/types/_shared";

export async function apiFetchPaginated<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<PaginatedResponse<T>> {
  const { method = "GET", body, query, headers, signal, suppressGlobalError = false } = opts;

  if (USE_MOCK) {
    const match = findMockHandler(method as MockMethod, path);
    if (match) {
      try {
        return (await match.handler({ params: match.params, query, body })) as PaginatedResponse<T>;
      } catch (error) {
        if (error instanceof ApiError) {
          dispatchGlobalApiError(error, { path, method, suppressGlobalError });
        }
        throw error;
      }
    }
  }

  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as { name?: unknown })?.name === "AbortError") throw error;
    throwApiError(
      new ApiError({ code: "NETWORK_ERROR", message: "网络请求失败，请检查网络后重试" }),
      { path, method, suppressGlobalError },
    );
  }

  if (res.status === 401) {
    setAuthToken(null);
    unauthorizedHandler?.();
    throwApiError(
      new ApiError({ code: "UNAUTHORIZED", message: "未登录或登录已失效" }, 401),
      { path, method, suppressGlobalError },
    );
  }

  const raw = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const snippet = raw.length > 240 ? raw.slice(0, 240) + "…" : raw;
    const contentType = res.headers.get("content-type") ?? "<missing>";
    throwApiError(
      new ApiError(
        {
          code: "PARSE_ERROR",
          message:
            `服务器返回了非标准错误响应：${path}（HTTP ${res.status}，${contentType}）。` +
            `响应内容：${snippet || "<empty>"}`,
        },
        res.status,
      ),
      { path, method, suppressGlobalError },
    );
  }

  if (!res.ok) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "HTTP_ERROR",
      message: `HTTP ${res.status}`,
    };
    throwApiError(new ApiError(err, res.status), { path, method, suppressGlobalError });
  }

  const envelope = parsed as PaginatedResponse<T>;
  if (!envelope || envelope.success !== true || !envelope.pagination) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "BAD_ENVELOPE",
      message: "Response envelope missing pagination metadata",
    };
    throwApiError(new ApiError(err, res.status), { path, method, suppressGlobalError });
  }
  return envelope;
}
