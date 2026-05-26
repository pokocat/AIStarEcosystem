// ─────────────────────────────────────────────────────────────────────────────
// api/account.ts — 用户账户 / 钱包 / 流水 API（network-only）。
// 对应后端 AccountController: /api/me/*
//
// USE_MOCK 模式由 _bootstrap-mocks.ts 在 apiFetch 网络层拦截，提供占位用户 / 钱包，
// 让 AuthProvider 启动 / shell 顶栏 wallet badge 在无后端时也能渲染。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Tenant } from "@ai-star-eco/types/account";
import type {
  Wallet,
  LedgerEntry,
  RechargePackage,
  RechargeRequest,
  RechargeResponse,
} from "@ai-star-eco/types/wallet";
import { apiFetch } from "../_client";

/** 获取当前登录用户信息 */
export async function getMe(): Promise<AepUser> {
  return apiFetch<AepUser>("/me");
}

/** 更新当前用户的可编辑资料 */
export async function updateProfile(
  data: Partial<Pick<AepUser, "displayName" | "avatarUrl" | "phone" | "email" | "bio" | "langPreference">>,
): Promise<AepUser> {
  return apiFetch<AepUser>("/me", {
    method: "PATCH",
    body: data,
  });
}

/** 获取当前用户关联的机构列表 */
export async function getMyTenants(): Promise<Tenant[]> {
  return apiFetch<Tenant[]>("/me/tenants");
}

/** 获取当前用户钱包 */
export async function getMyWallet(): Promise<Wallet> {
  return apiFetch<Wallet>("/me/wallet");
}

/** 获取当前用户点数流水（分页） */
export async function getMyLedger(page = 0, size = 20): Promise<LedgerEntry[]> {
  return apiFetch<LedgerEntry[]>("/me/ledger", {
    query: { page, size },
  });
}

/** v0.33+: 可购买的充值套餐列表 */
export async function listRechargePackages(): Promise<RechargePackage[]> {
  return apiFetch<RechargePackage[]>("/me/wallet/packages");
}

/** v0.33+: 充值落账（MVP 直接走，无支付网关） */
export async function rechargeWallet(req: RechargeRequest): Promise<RechargeResponse> {
  return apiFetch<RechargeResponse>("/me/wallet/recharge", {
    method: "POST",
    body: req,
  });
}
