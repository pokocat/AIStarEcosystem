// ─────────────────────────────────────────────────────────────────────────────
// api/settings.ts — 设置（积分包 / 充值历史）API 封装。
// 已废弃订阅相关接口，改为积分包售卖。
// ─────────────────────────────────────────────────────────────────────────────

import type { CreditPack, RechargeRecord } from "@/types/settings";
import { CREDIT_PACKS, RECHARGE_HISTORY } from "@/mocks/settings";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listCreditPacks(): Promise<CreditPack[]> {
  if (USE_MOCK) return mockDelay(CREDIT_PACKS);
  return apiFetch<CreditPack[]>("/settings/credit-packs");
}

export async function listRechargeHistory(): Promise<RechargeRecord[]> {
  if (USE_MOCK) return mockDelay(RECHARGE_HISTORY);
  return apiFetch<RechargeRecord[]>("/settings/recharge-history");
}
