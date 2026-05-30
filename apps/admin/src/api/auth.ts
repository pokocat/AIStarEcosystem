// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — Admin 鉴权。对应 AdminAuthController。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, mockDelay, setAuthToken, USE_MOCK } from "./_client";

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

const MOCK_ADMIN_USER: AdminMeUser = {
  id: "mock-admin",
  username: "admin",
  email: "admin@example.local",
  displayName: "Mock 超管",
  role: "super_admin",
  status: "active",
  accountSource: "admin",
};

const MOCK_OPERATOR_USER: AdminMeUser = {
  id: "mock-operator",
  username: "celebrity_operator",
  email: "operator@example.local",
  displayName: "Mock 运营",
  role: "operator",
  status: "active",
  accountSource: "operator",
};

let mockCurrentUser: AdminMeUser | null = null;

/** 管理员登录 */
export async function login(req: AdminLoginRequest): Promise<AdminLoginResult> {
  if (USE_MOCK) {
    const token = `mock-admin-token-${Date.now()}`;
    setAuthToken(token);
    mockCurrentUser = {
      ...MOCK_ADMIN_USER,
      username: req.username || MOCK_ADMIN_USER.username,
      lastLoginAt: new Date().toISOString(),
    };
    return mockDelay({ token, user: mockCurrentUser });
  }
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
  if (USE_MOCK) {
    const token = `mock-operator-token-${Date.now()}`;
    setAuthToken(token);
    mockCurrentUser = {
      ...MOCK_OPERATOR_USER,
      username: req.username || MOCK_OPERATOR_USER.username,
      lastLoginAt: new Date().toISOString(),
    };
    return mockDelay({ token, user: mockCurrentUser });
  }
  const result = await apiFetch<AdminLoginResult>("/admin/auth/operator-login", {
    method: "POST",
    body: req,
  });
  setAuthToken(result.token);
  return result;
}

/** 获取当前管理员信息 */
export async function getMe(): Promise<AdminMeUser> {
  if (USE_MOCK) return mockDelay(mockCurrentUser ?? MOCK_ADMIN_USER);
  return apiFetch<AdminMeUser>("/admin/auth/me");
}

/** 当前登录账号修改自己的密码，兼容 admin_users 与 operator-login 两套账号来源。 */
export async function changePassword(req: ChangePasswordRequest): Promise<void> {
  if (USE_MOCK) {
    if (!req.currentPassword || !req.newPassword) throw new Error("当前密码和新密码不能为空");
    if (req.newPassword.length < 6) throw new Error("新密码至少 6 位");
    return mockDelay(undefined);
  }
  await apiFetch<Record<string, never>>("/admin/auth/change-password", {
    method: "POST",
    body: req,
  });
}
