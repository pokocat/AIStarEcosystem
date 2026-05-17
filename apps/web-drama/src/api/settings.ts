// ─────────────────────────────────────────────────────────────────────────────
// api/settings.ts — 积分包 / 充值历史 API（network-only）。
// USE_MOCK 模式由 src/mocks/_handlers/settings.ts 拦截。
// 已废弃订阅相关接口，改为积分包售卖。
// ─────────────────────────────────────────────────────────────────────────────

import type { CreditPack, RechargeRecord } from "@ai-star-eco/types/settings";
import type { ID } from "@ai-star-eco/types/_shared";
import { apiFetch } from "./_client";

export async function listCreditPacks(): Promise<CreditPack[]> {
  return apiFetch<CreditPack[]>("/settings/credit-packs");
}

export async function listRechargeHistory(): Promise<RechargeRecord[]> {
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
  return apiFetch<CreditPurchaseWire>(
    `/settings/credit-packs/${encodeURIComponent(packId)}/purchase`,
    { method: "POST", body: paymentMeta ?? {} },
  );
}

export async function listCreditPurchases(): Promise<CreditPurchaseWire[]> {
  return apiFetch<CreditPurchaseWire[]>("/settings/purchases");
}
