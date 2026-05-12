// ─────────────────────────────────────────────────────────────────────────────
// api/account.ts — 用户账户 / 钱包 / 流水 API。
// 对应后端 AccountController: /api/me/*
//
// USE_MOCK=1 时返回 _mocks.ts 的占位用户 + 钱包，让 AuthProvider 启动 / shell
// 顶栏的 wallet badge 在无后端时也能渲染。业务侧的 ledger 写入仍是空数组。
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Tenant } from "@ai-star-eco/types/account";
import type { Wallet, LedgerEntry } from "@ai-star-eco/types/wallet";
import { apiFetch, mockDelay, USE_MOCK } from "../_client";
import { MOCK_TENANTS, MOCK_USER, MOCK_WALLET } from "../_mocks";

/** 获取当前登录用户信息 */
export async function getMe(): Promise<AepUser> {
  if (USE_MOCK) return mockDelay(MOCK_USER);
  return apiFetch<AepUser>("/me");
}

/** 更新当前用户的可编辑资料 */
export async function updateProfile(
  data: Partial<Pick<AepUser, "displayName" | "avatarUrl" | "phone" | "email" | "bio" | "langPreference">>,
): Promise<AepUser> {
  if (USE_MOCK) return mockDelay({ ...MOCK_USER, ...data, updatedAt: new Date().toISOString() });
  return apiFetch<AepUser>("/me", {
    method: "PATCH",
    body: data,
  });
}

/** 获取当前用户关联的机构列表 */
export async function getMyTenants(): Promise<Tenant[]> {
  if (USE_MOCK) return mockDelay(MOCK_TENANTS);
  return apiFetch<Tenant[]>("/me/tenants");
}

/** 获取当前用户钱包 */
export async function getMyWallet(): Promise<Wallet> {
  if (USE_MOCK) return mockDelay(MOCK_WALLET);
  return apiFetch<Wallet>("/me/wallet");
}

/** 获取当前用户点数流水（分页） */
export async function getMyLedger(page = 0, size = 20): Promise<LedgerEntry[]> {
  if (USE_MOCK) return mockDelay<LedgerEntry[]>([]);
  return apiFetch<LedgerEntry[]>("/me/ledger", {
    query: { page, size },
  });
}
