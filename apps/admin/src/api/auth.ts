// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — Admin 鉴权。对应 AdminAuthController。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, setAuthToken } from "./_client";

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResult {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
  };
}

/** 管理员登录 */
export async function login(req: AdminLoginRequest): Promise<AdminLoginResult> {
  const result = await apiFetch<AdminLoginResult>("/admin/auth/login", {
    method: "POST",
    body: req,
  });
  setAuthToken(result.token);
  return result;
}

/** 获取当前管理员信息 */
export async function getMe(): Promise<AdminLoginResult["user"]> {
  return apiFetch<AdminLoginResult["user"]>("/admin/auth/me");
}
