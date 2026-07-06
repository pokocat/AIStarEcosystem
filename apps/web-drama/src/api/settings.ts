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

// 注：purchaseCreditPack() 已随后端 SettingsController.purchaseCreditPack 一并删除
// （例行 QA 2026-07-05 审计 F-01：该端点绕过 CreditService 直接写 Wallet + Ledger，
// 且落入 /api/settings/** 的 permitAll 兜底，等价零支付无限刷积分；本函数确认无任何
// UI 入口调用，属死代码）。充值统一走 v0.56 起的 RechargeService 收银台订单流。

export async function listCreditPurchases(): Promise<CreditPurchaseWire[]> {
  return apiFetch<CreditPurchaseWire[]>("/settings/purchases");
}
