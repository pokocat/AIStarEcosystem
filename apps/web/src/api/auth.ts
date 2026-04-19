// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — 鉴权 API 封装。
// 对应后端：
//   POST /api/auth/activate    （正式秘钥激活注册）
//   GET  /api/auth/dev-accounts（开发期账号列表，仅 dev profile）
//   POST /api/auth/dev-login   （开发期免密登录，仅 dev profile）
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser } from "@/types/account";
import type { LicenseRedeemRequest, LicenseRedeemResult } from "@/types/license";
import { apiFetch, setAuthToken, USE_MOCK, mockDelay } from "./_client";
import { CURRENT_USER } from "@/mocks/account";

/** License 激活码注册（公开接口） */
export async function activate(req: LicenseRedeemRequest): Promise<LicenseRedeemResult> {
  return apiFetch<LicenseRedeemResult>("/auth/activate", {
    method: "POST",
    body: req,
  });
}

// ── 开发期免密登录（仅 dev profile） ─────────────────────────────────────────

export interface DevAccount {
  username: string;
  displayName: string;
  studioName: string;
  studioKind: string;
}

/** 返回一组可登录的 STUDIO 账号（下拉用）。 */
export async function listDevAccounts(): Promise<DevAccount[]> {
  if (USE_MOCK) {
    return mockDelay([
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

/**
 * 开发期免密登录：传入用户名直接签发 JWT。
 * 成功后把 token 写入 localStorage，之后 apiFetch 会自动携带。
 */
export async function devLogin(username?: string): Promise<DevLoginResult> {
  if (USE_MOCK) {
    const token = "mock-dev-token";
    setAuthToken(token);
    return mockDelay({ token, user: CURRENT_USER });
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
