// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — Admin 鉴权。对应 AdminAuthController。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

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
  return apiFetch<AdminLoginResult>("/admin/auth/login", {
    method: "POST",
    body: req,
  });
}

/** 获取当前管理员信息 */
export async function getMe(): Promise<AdminLoginResult["user"]> {
  return apiFetch<AdminLoginResult["user"]>("/admin/auth/me");
}
