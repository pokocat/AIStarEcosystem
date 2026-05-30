// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — Admin 鉴权。对应 AdminAuthController。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, setAuthToken } from "./_client";

export type AdminAccountSource = "admin" | "operator";

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminMeUser {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  role: string;
  status: string;
  accountSource: AdminAccountSource;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface AdminLoginResult {
  token: string;
  user: AdminMeUser;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
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

/**
 * v0.37：平台运营登录（AepUser + operatorRole 体系）。
 * 与 admin_users 完全独立，但 JWT.role 出 OPERATOR / SUPER_ADMIN，可通过 hasAnyRole 门禁。
 */
export async function operatorLogin(req: AdminLoginRequest): Promise<AdminLoginResult> {
  const result = await apiFetch<AdminLoginResult>("/admin/auth/operator-login", {
    method: "POST",
    body: req,
  });
  setAuthToken(result.token);
  return result;
}

/** 获取当前管理员信息 */
export async function getMe(): Promise<AdminMeUser> {
  return apiFetch<AdminMeUser>("/admin/auth/me");
}

/** 当前登录账号修改自己的密码，兼容 admin_users 与 operator-login 两套账号来源。 */
export async function changePassword(req: ChangePasswordRequest): Promise<void> {
  await apiFetch<Record<string, never>>("/admin/auth/change-password", {
    method: "POST",
    body: req,
  });
}
