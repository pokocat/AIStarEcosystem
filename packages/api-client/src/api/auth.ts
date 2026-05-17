// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — 鉴权 API（network-only）。
// 对应后端：
//   POST /api/auth/activate
//   GET  /api/auth/dev-accounts
//   POST /api/auth/dev-login
//
// USE_MOCK 模式由 _bootstrap-mocks.ts 拦截，让协作者无需启动 server 也能体验
// landing → /login → 工作台全链路。setAuthToken 副作用始终在调用方完成。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser } from "@ai-star-eco/types/account";
import type { LicenseRedeemRequest, LicenseRedeemResult } from "@ai-star-eco/types/license";
import { apiFetch, setAuthToken } from "../_client";

/** License 激活码注册（公开接口） */
export async function activate(req: LicenseRedeemRequest): Promise<LicenseRedeemResult> {
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
  return apiFetch<DevAccount[]>("/auth/dev-accounts");
}

export interface DevLoginResult {
  token: string;
  user: AepUser;
}

/** 开发期免密登录：传入用户名直接签发 JWT。 */
export async function devLogin(username?: string): Promise<DevLoginResult> {
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
