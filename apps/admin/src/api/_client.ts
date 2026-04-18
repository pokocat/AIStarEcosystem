// ─────────────────────────────────────────────────────────────────────────────
// _client.ts — Admin 后台 API 调用底座。
// 通过 NEXT_PUBLIC_USE_MOCK=1 切换为仅使用 mocks/ 数据（无网络）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ApiResponse, ApiErrorShape } from "@/types/_shared";

/** 当 NEXT_PUBLIC_USE_MOCK=1 时，API 层直接返回 mocks/ 目录中的静态数据。 */
export const USE_MOCK: boolean =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_MOCK === "1";

/** 后端基础地址，默认 /api（同域反向代理），可通过环境变量覆盖。 */
export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "/api";

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

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: "include",
  });

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
