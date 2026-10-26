import type {
  StudioCreditEventPage,
  StudioOperationsDashboard,
  StudioReconciliationDetailPage,
} from "@ai-star-eco/types/studio-operations";
import { studioAdminPath } from "@/lib/app-path";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "/api").replace(/\/+$/, "");
export const AUTH_TOKEN_KEY = "aistareco.studio-admin.auth.token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function authToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  else window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const params = new URLSearchParams();
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const token = authToken();
  const response = await fetch(`${API_BASE}${path}${params.size ? `?${params}` : ""}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-App-Code": "admin",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
  });
  const payload = await response.json().catch(() => undefined) as
    | { success?: boolean; data?: T; error?: { code?: string; message?: string } }
    | undefined;
  if (!response.ok || payload?.success !== true) {
    const error = new ApiError(
      payload?.error?.message || (response.status === 401 ? "登录状态无效或已过期" : `请求失败（${response.status}）`),
      payload?.error?.code || (response.status === 403 ? "FORBIDDEN" : "HTTP_ERROR"),
      response.status,
    );
    if (response.status === 401 && typeof window !== "undefined") {
      setAuthToken(null);
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`${studioAdminPath("/login")}?next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
  return payload.data as T;
}

export interface AdminIdentity {
  id: string;
  username: string;
  displayName: string;
  role: string;
  accountSource: "admin" | "operator";
}

export const AuthApi = {
  me: () => request<AdminIdentity>("/admin/auth/me"),
  login: async (username: string, password: string, source: "admin" | "operator") => {
    const result = await request<{ token: string; user: AdminIdentity }>(
      source === "operator" ? "/admin/auth/operator-login" : "/admin/auth/login",
      { method: "POST", body: { username, password } },
    );
    setAuthToken(result.token);
    return result.user;
  },
  logout: () => setAuthToken(null),
};

export const StudioOperationsApi = {
  dashboard: (days: 1 | 7 | 30) =>
    request<StudioOperationsDashboard>("/admin/studio-operations", { query: { days } }),
  reconciliationDetails: (check: string, page = 0, size = 20) =>
    request<StudioReconciliationDetailPage>("/admin/studio-operations/reconciliation-details", {
      query: { check, page, size },
    }),
  creditEvents: (days: 1 | 7 | 30, page = 0, type?: string, query?: string) =>
    request<StudioCreditEventPage>("/admin/studio-operations/credit-events", {
      query: { days, page, size: 20, type, query },
    }),
};
