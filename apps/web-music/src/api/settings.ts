// ─────────────────────────────────────────────────────────────────────────────
// api/settings.ts — 设置（积分包 / 充值历史）API 封装。
// 已废弃订阅相关接口，改为积分包售卖。
// ─────────────────────────────────────────────────────────────────────────────

import type { CreditPack, RechargeRecord } from "@ai-star-eco/types/settings";
import type { ID } from "@ai-star-eco/types/_shared";
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

export interface CreditPurchaseWire {
  id: ID;
  userId: ID;
  packId: ID;
  priceCents: number;
  creditsAdded: number;
  createdAt: string;
}

/** 购买积分包。成功后后端同时写 LedgerEntry(RECHARGE) 并更新 Wallet。 */
export async function purchaseCreditPack(
  packId: ID,
  paymentMeta?: Record<string, unknown>,
): Promise<CreditPurchaseWire> {
  if (USE_MOCK) {
    return mockDelay({
      id: `mock-${Date.now()}`,
      userId: "mock-user",
      packId, priceCents: 9_900, creditsAdded: 1_000,
      createdAt: new Date().toISOString(),
    });
  }
  return apiFetch<CreditPurchaseWire>(
    `/settings/credit-packs/${encodeURIComponent(packId)}/purchase`,
    { method: "POST", body: paymentMeta ?? {} },
  );
}

export async function listCreditPurchases(): Promise<CreditPurchaseWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<CreditPurchaseWire[]>("/settings/purchases");
}
