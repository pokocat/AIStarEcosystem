// ─────────────────────────────────────────────────────────────────────────────
// api/settings.ts — 系统设置：积分包、充值记录
// ─────────────────────────────────────────────────────────────────────────────

import type { CreditPack, RechargeRecord } from "@/types/settings";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import { CREDIT_PACKS, RECHARGE_HISTORY } from "@/mocks/settings";

export async function listCreditPacks(): Promise<CreditPack[]> {
  if (USE_MOCK) return mockDelay(CREDIT_PACKS);
  return apiFetch<CreditPack[]>("/admin/settings/credit-packs");
}

export async function listRechargeHistory(
  page = 0, size = 20, userId?: string
): Promise<RechargeRecord[]> {
  if (USE_MOCK) return mockDelay(RECHARGE_HISTORY);
  return apiFetch<RechargeRecord[]>("/admin/settings/recharge-history", {
    query: { page, size, userId },
  });
}
