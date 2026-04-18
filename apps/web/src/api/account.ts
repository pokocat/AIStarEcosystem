// ─────────────────────────────────────────────────────────────────────────────
// api/account.ts — 用户账户 / 钱包 / 流水 API 封装。
// 对应后端 AccountController: /api/me/*
// ─────────────────────────────────────────────────────────────────────────────

import type { AepUser, Tenant } from "@/types/account";
import type { Wallet, LedgerEntry } from "@/types/wallet";
import { CURRENT_USER, MY_TENANTS } from "@/mocks/account";
import { MY_WALLET, MY_LEDGER_ENTRIES } from "@/mocks/wallet";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/** 获取当前登录用户信息 */
export async function getMe(): Promise<AepUser> {
  if (USE_MOCK) return mockDelay(CURRENT_USER);
  return apiFetch<AepUser>("/me");
}

/** 更新当前用户的可编辑资料 */
export async function updateProfile(
  data: Partial<Pick<AepUser, "displayName" | "avatarUrl" | "phone" | "email" | "bio" | "langPreference">>
): Promise<AepUser> {
  if (USE_MOCK) return mockDelay({ ...CURRENT_USER, ...data });
  return apiFetch<AepUser>("/me", {
    method: "PATCH",
    body: data,
  });
}

/** 获取当前用户关联的机构列表 */
export async function getMyTenants(): Promise<Tenant[]> {
  if (USE_MOCK) return mockDelay(MY_TENANTS);
  return apiFetch<Tenant[]>("/me/tenants");
}

/** 获取当前用户钱包 */
export async function getMyWallet(): Promise<Wallet> {
  if (USE_MOCK) return mockDelay(MY_WALLET);
  return apiFetch<Wallet>("/me/wallet");
}

/** 获取当前用户点数流水（分页） */
export async function getMyLedger(page = 0, size = 20): Promise<LedgerEntry[]> {
  if (USE_MOCK) return mockDelay(MY_LEDGER_ENTRIES);
  return apiFetch<LedgerEntry[]>("/me/ledger", {
    query: { page, size },
  });
}
