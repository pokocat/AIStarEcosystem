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

// ── v0.31+ 手机号 + SMS 验证码 登录 / 注册 ────────────────────────────────

/**
 * 请求一个新的短信验证码。失败抛 ApiError（429 速率限制 / 锁定；400 手机号格式）。
 * 成功无显式返回（resolve 即可），码默认 5 分钟有效。
 */
export async function smsRequestCode(phone: string): Promise<void> {
  await apiFetch<{ sent: boolean }>("/auth/sms/request-code", {
    method: "POST",
    body: { phone },
  });
}

export interface SmsLoginResult {
  token: string;
  user: AepUser;
}

/**
 * 手机号 + 验证码 登录。
 * - 200 + token：找到 user → 自动 setAuthToken
 * - 404 USER_NOT_FOUND：phone 未注册 → 引导用户去 /sms/register
 *   注意：验证码已被消费（防爆破）
 * - 400 SMS_CODE_INVALID / 429 SMS_CODE_LOCKED 等
 */
export async function smsLogin(phone: string, code: string): Promise<SmsLoginResult> {
  const result = await apiFetch<SmsLoginResult>("/auth/sms/verify", {
    method: "POST",
    body: { phone, code },
  });
  if (result?.token) setAuthToken(result.token);
  return result;
}

export interface SmsRegisterPayload {
  phone: string;
  code: string;
  licenseKey: string;
  studioName: string;
  displayName?: string;
}

export interface SmsRegisterResult {
  token: string;
  user: AepUser;
  studio?: unknown;
  tenantId?: string;
}

/**
 * 手机号 + 激活码 双因素注册。
 * 创建 STUDIO 账号 + 工作室 + 钱包；成功自动 setAuthToken。
 */
export async function smsRegister(payload: SmsRegisterPayload): Promise<SmsRegisterResult> {
  const result = await apiFetch<SmsRegisterResult>("/auth/sms/register", {
    method: "POST",
    body: payload,
  });
  if (result?.token) setAuthToken(result.token);
  return result;
}
