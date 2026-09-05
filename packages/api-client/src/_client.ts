// ─────────────────────────────────────────────────────────────────────────────
// _client.ts — 前端 API 调用底座。
// 通过 NEXT_PUBLIC_USE_MOCK=1 切换为仅使用 mocks/ 数据（无网络）。
//
// 登录模式见 ./config.ts：
//   - legacy —— 本仓 server 发短信码 / 签 HS256 令牌（历史行为，本文件逻辑不变）
//   - id     —— 统一账号中心 OIDC + PKCE（./oidc.ts）；401 先单飞刷新一次再重放
// 跨子域 SSO 的历史 cookie 方案已被账号中心方案取代，见
// docs/unified-identity-plan.md 决策 D9（令牌仍存 localStorage，由 issuer 统一签发）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiResponse, ApiErrorShape } from "@ai-star-eco/types/_shared";
import { findMockHandler, type MockMethod } from "./_mock-registry";
import { API_BASE_URL, ENABLE_DEV_LOGIN, USE_MOCK, isIdMode } from "./config";
import { clearAuthTokens, getAuthToken } from "./token-store";
import { beginLogin, isTransientOidcError, refreshAccessToken } from "./oidc";

export { API_BASE_URL, ENABLE_DEV_LOGIN, USE_MOCK };
export {
  AUTH_TOKEN_KEY,
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_EXPIRES_AT_KEY,
  AUTH_ID_TOKEN_KEY,
  clearAuthTokens,
  getAuthToken,
  setAuthToken,
  getRefreshToken,
  setRefreshToken,
  getIdToken,
  setIdToken,
  getTokenExpiresAt,
  setTokenExpiresAt,
} from "./token-store";

/**
 * 来源子应用短码（music / drama / celebrity / aiavatar / star）。由 AuthProvider 在挂载时注入，
 * apiFetch 自动作为 `X-App-Code` 头带上 —— 让 server 审计日志能区分登录来自哪个子应用。
 * 未设置时不带该头（server 端落 null）。
 */
let appCode: string | null = null;
export function setAppCode(code: string | null) {
  appCode = code && code.trim() ? code.trim() : null;
}

/**
 * 401 回调——由 AuthContext 注册，用于把用户踢回登录页。
 * 返回 `true` 表示「已自行处理」，此时 id 模式不再兜底跳账号中心
 * （AuthProvider 在公开路径上就这么用：清掉用户态但让人留在 landing）。
 */
type UnauthorizedHandler = () => boolean | void;
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
  suppressParseErrorLog?: boolean;
  /** @internal id 模式刷新令牌后的重放标记；外部不要传。 */
  __idRetry?: boolean;
}

/**
 * 统一 401 处置（两种模式共用）：清令牌 → 通知 AuthContext → id 模式下若无人接管
 * 则直接回账号中心重新授权。
 */
function handleUnauthorized() {
  clearAuthTokens();
  const handled = unauthorizedHandler?.();
  if (handled === true) return;
  if (isIdMode()) void beginLogin();
}

/**
 * 刷新令牌这一步本身没能完成时的错误码（P1-8）。
 *
 * 场景：`/api/me` 回 401 → 去账号中心换新令牌 → **换令牌的请求**撞上断网 / 5xx / 超时。
 * 这时既不能判定「没登录」（令牌可能好好的），也不能继续用旧令牌重放 —— 于是抛这个
 * 带 503 的错误：令牌**原样保留**，由 AuthProvider 进 `error` 态给重试屏。
 */
export const AUTH_REFRESH_UNAVAILABLE = "AUTH_REFRESH_UNAVAILABLE";

/** 判定一个异常是不是「刷新令牌时后端不可用」（可重试，不是没登录）。 */
export function isAuthRefreshUnavailableError(e: unknown): e is ApiError {
  return e instanceof ApiError && e.code === AUTH_REFRESH_UNAVAILABLE;
}

/**
 * id 模式的 401 兜底刷新：成功返回 true（调用方重放请求），确认失效返回 false
 * （令牌已被 oidc 清空，调用方走 handleUnauthorized）。
 * 暂时性故障抛 `ApiError{AUTH_REFRESH_UNAVAILABLE, 503}` —— **不清令牌、不跳登录**。
 */
async function tryIdRefresh(): Promise<boolean> {
  try {
    return await refreshAccessToken();
  } catch (e) {
    if (isTransientOidcError(e)) {
      throw new ApiError(
        {
          code: AUTH_REFRESH_UNAVAILABLE,
          message: "暂时无法确认登录状态，请稍后重试。",
          details: { reason: e.reason ?? e.code },
        },
        503,
      );
    }
    throw e;
  }
}

/** 后端「本产品未开通」错误码（docs/unified-identity-plan.md §12.2）。 */
export const PRODUCT_NOT_ENROLLED = "PRODUCT_NOT_ENROLLED";

/**
 * 403 `PRODUCT_NOT_ENROLLED` 回调 —— 由 AuthProvider 注册。
 * 任何业务请求撞上开通闸时都会触发，让工作台立刻切到开通页，
 * 而不是把「你没权限」的原始错误码扔给用户看。
 */
type EnrollmentRequiredHandler = (product: string | null) => void;
let enrollmentRequiredHandler: EnrollmentRequiredHandler | null = null;
export function registerEnrollmentRequiredHandler(fn: EnrollmentRequiredHandler | null) {
  enrollmentRequiredHandler = fn;
}

/** 判定一个异常是不是「本产品未开通」。 */
export function isProductNotEnrolledError(e: unknown): e is ApiError {
  return e instanceof ApiError && e.code === PRODUCT_NOT_ENROLLED;
}

/** 从 403 响应体里取出产品短码（`error.details.product`），取不到返回 null。 */
function readEnrollmentProduct(details: unknown): string | null {
  if (details && typeof details === "object" && "product" in details) {
    const p = (details as { product?: unknown }).product;
    if (typeof p === "string" && p) return p;
  }
  return null;
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
    __idRetry = false,
  } = opts;

  // USE_MOCK：在网络层拦截，命中 registry 直接返回 handler 结果（已是 unwrapped T）。
  // handler 抛 ApiError 即可模拟错误。未注册路径会落到下方网络分支（dev 期可见 404，便于发现缺口）。
  if (USE_MOCK) {
    const match = findMockHandler(method as MockMethod, path);
    if (match) {
      return (await match.handler({ params: match.params, query, body })) as T;
    }
  }

  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;

  const token = getAuthToken();
  // FormData 支持 multipart 上传：不设 Content-Type，让浏览器自动加 boundary
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(appCode ? { "X-App-Code": appCode } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
    credentials: "include",
  });

  if (res.status === 401) {
    // id 模式：先单飞刷新一次令牌再重放本次请求（并发 401 共享同一次刷新）。
    // 刷新本身失败但属于暂时故障时，tryIdRefresh 直接抛 503，不会往下走清令牌分支。
    if (isIdMode() && !__idRetry) {
      const refreshed = await tryIdRefresh();
      if (refreshed) {
        return apiFetch<T>(path, { ...opts, __idRetry: true });
      }
    }
    handleUnauthorized();
    throw new ApiError({ code: "UNAUTHORIZED", message: "未登录或登录已失效" }, 401);
  }

  const raw = await res.text();
  if (!raw) {
    if (!res.ok) {
      throw new ApiError(
        { code: "HTTP_ERROR", message: `HTTP ${res.status}` },
        res.status
      );
    }
    if (res.status !== 204 && res.status !== 205) {
      throw new ApiError(
        { code: "BAD_ENVELOPE", message: "Response envelope missing success:true" },
        res.status
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
      console.error(
        `[apiFetch] non-JSON body from ${path}  status=${res.status}  ` +
          `content-type=${contentType}\n` +
          snippet,
      );
    }
    if (!res.ok) {
      throw new ApiError(
        {
          code: "HTTP_ERROR",
          message:
            res.status >= 500
              ? `服务器处理请求失败（HTTP ${res.status}）`
              : `请求失败（HTTP ${res.status}）`,
          details: { contentType, snippet },
        },
        res.status,
      );
    }
    throw new ApiError(
      {
        code: "PARSE_ERROR",
        message:
          `Invalid JSON from ${path} (status=${res.status}, content-type=${contentType}). ` +
          `Body starts with: ${snippet || "<empty>"}`,
      },
      res.status,
    );
  }

  if (!res.ok) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "HTTP_ERROR",
      message: `HTTP ${res.status}`,
    };
    if (res.status === 403 && err.code === PRODUCT_NOT_ENROLLED) {
      enrollmentRequiredHandler?.(readEnrollmentProduct(err.details));
    }
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
  const { method = "GET", body, query, headers, signal, __idRetry = false } = opts;

  if (USE_MOCK) {
    const match = findMockHandler(method as MockMethod, path);
    if (match) {
      return (await match.handler({ params: match.params, query, body })) as PaginatedResponse<T>;
    }
  }

  const url = `${API_BASE_URL}${path}${buildQuery(query)}`;
  const token = getAuthToken();
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(appCode ? { "X-App-Code": appCode } : {}),
      ...(headers ?? {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 401) {
    if (isIdMode() && !__idRetry) {
      const refreshed = await tryIdRefresh();
      if (refreshed) {
        return apiFetchPaginated<T>(path, { ...opts, __idRetry: true });
      }
    }
    handleUnauthorized();
    throw new ApiError({ code: "UNAUTHORIZED", message: "未登录或登录已失效" }, 401);
  }

  const raw = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const snippet = raw.length > 240 ? raw.slice(0, 240) + "…" : raw;
    const contentType = res.headers.get("content-type") ?? "<missing>";
    throw new ApiError(
      {
        code: "PARSE_ERROR",
        message:
          `Invalid JSON from ${path} (status=${res.status}, content-type=${contentType}). ` +
          `Body starts with: ${snippet || "<empty>"}`,
      },
      res.status,
    );
  }

  if (!res.ok) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "HTTP_ERROR",
      message: `HTTP ${res.status}`,
    };
    if (res.status === 403 && err.code === PRODUCT_NOT_ENROLLED) {
      enrollmentRequiredHandler?.(readEnrollmentProduct(err.details));
    }
    throw new ApiError(err, res.status);
  }

  const envelope = parsed as PaginatedResponse<T>;
  if (!envelope || envelope.success !== true || !envelope.pagination) {
    const err = (parsed as { error?: ApiErrorShape })?.error ?? {
      code: "BAD_ENVELOPE",
      message: "Response envelope missing pagination metadata",
    };
    throw new ApiError(err, res.status);
  }
  return envelope;
}
