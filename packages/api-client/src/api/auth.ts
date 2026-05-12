// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — 鉴权 API。
// 对应后端：
//   POST /api/auth/activate
//   GET  /api/auth/dev-accounts
//   POST /api/auth/dev-login
//
// 默认走真实后端；NEXT_PUBLIC_USE_MOCK=1 时返回 _mocks.ts 的占位数据，
// 让协作者无需启动 server 也能体验 landing → /login → /console 全链路。
// 业务领域 mock 仍在各 web app 的 src/api 层维护，api-client 只兜底
// auth + account 这一对，避免 dev-login 这种"启动条件"自身就需要后端。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser } from "@ai-star-eco/types/account";
import type { LicenseRedeemRequest, LicenseRedeemResult } from "@ai-star-eco/types/license";
import { apiFetch, mockDelay, setAuthToken, USE_MOCK } from "../_client";
import { MOCK_USER } from "../_mocks";

/** License 激活码注册（公开接口） */
export async function activate(req: LicenseRedeemRequest): Promise<LicenseRedeemResult> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    const token = `mock-activate-${Date.now()}`;
    setAuthToken(token);
    const studio = {
      id: `s-${req.username}`,
      ownerUserId: MOCK_USER.id,
      name: req.studioName,
      kind: req.studioKind ?? "personal_creator",
      status: "active" as const,
      bio: "",
      contactEmail: req.email,
      contactPhone: req.phone,
      createdAt: now,
      updatedAt: now,
    };
    const user: AepUser = {
      ...MOCK_USER,
      username: req.username,
      displayName: req.displayName || req.studioName,
      email: req.email ?? MOCK_USER.email,
      phone: req.phone ?? MOCK_USER.phone,
      updatedAt: now,
      lastLoginAt: now,
      studio,
    };
    return mockDelay<LicenseRedeemResult>({
      token,
      user,
      studio,
      tenantId: `t-${studio.id}`,
    });
  }
  const result = await apiFetch<LicenseRedeemResult>("/auth/activate", {
    method: "POST",
    body: req,
  });
  if (result?.token) setAuthToken(result.token);
  return result;
}

export interface DevAccount {
  username: string;
  displayName: string;
  studioName: string;
  studioKind: string;
}

/** 返回一组可登录的 STUDIO 账号（dev profile 才返回非空）。 */
export async function listDevAccounts(): Promise<DevAccount[]> {
  if (USE_MOCK) {
    return mockDelay<DevAccount[]>([
      { username: "studio_starlight", displayName: "星光经纪", studioName: "星光工作室", studioKind: "agency" },
      { username: "agency_moonrise",  displayName: "月升经纪", studioName: "月升传媒",   studioKind: "mcn" },
    ]);
  }
  return apiFetch<DevAccount[]>("/auth/dev-accounts");
}

export interface DevLoginResult {
  token: string;
  user: AepUser;
}

/** 开发期免密登录：传入用户名直接签发 JWT。 */
export async function devLogin(username?: string): Promise<DevLoginResult> {
  if (USE_MOCK) {
    const token = "mock-dev-token";
    setAuthToken(token);
    const user: AepUser = username
      ? { ...MOCK_USER, username, displayName: username }
      : MOCK_USER;
    return mockDelay({ token, user });
  }
  const result = await apiFetch<DevLoginResult>("/auth/dev-login", {
    method: "POST",
    body: username ? { username } : {},
  });
  setAuthToken(result.token);
  return result;
}

export function logout() {
  setAuthToken(null);
}
