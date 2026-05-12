// ─────────────────────────────────────────────────────────────────────────────
// api/auth.ts — 鉴权 API（网络版本，无 mock 分支）。
// 对应后端：
//   POST /api/auth/activate
//   GET  /api/auth/dev-accounts
//   POST /api/auth/dev-login
//
// 注：apps/web 历史版本在 USE_MOCK=1 时返回 mocks/ 假数据；packages/api-client
// 是网络专用，新建 web app 若需 mock，应在自己的 src/api 层包一层。
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
