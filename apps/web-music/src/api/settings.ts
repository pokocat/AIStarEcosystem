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

// 注：purchaseCreditPack() 已随后端 SettingsController.purchaseCreditPack 一并删除
// （例行 QA 2026-07-05 审计 F-01：该端点绕过 CreditService 直接写 Wallet + Ledger，
// 且落入 /api/settings/** 的 permitAll 兜底，等价零支付无限刷积分；本函数确认无任何
// UI 入口调用，属死代码）。充值统一走 v0.56 起的 RechargeService 收银台订单流。

export async function listCreditPurchases(): Promise<CreditPurchaseWire[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<CreditPurchaseWire[]>("/settings/purchases");
}
