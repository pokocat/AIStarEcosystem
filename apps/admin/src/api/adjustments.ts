// ─────────────────────────────────────────────────────────────────────────────
// api/adjustments.ts — 运营调差 / 赠送（v2 §9 积分面）。
// 对应 AdminCreditOpsController（/api/admin/finance/adjustments）。
// 只发赠送积分（giftBalance），结构上不碰资金面；强制原因，补偿强制工单号。
// ─────────────────────────────────────────────────────────────────────────────

import type { LedgerEntry } from "@/types/wallet";
import { apiFetch } from "./_client";

const BASE = "/admin/finance/adjustments";

export interface GrantPayload {
  userId: string;
  amount: number;
  reason: string;
  campaignId?: string;
}

export interface CompensatePayload {
  userId: string;
  amount: number;
  incidentRef: string;
  reason: string;
}

/** 激励赠送：给用户发赠送积分（落 giftBalance），可挂活动号。返回新增的账本分录。 */
export async function grant(payload: GrantPayload): Promise<LedgerEntry> {
  return apiFetch<LedgerEntry>(`${BASE}/grant`, { method: "POST", body: payload });
}

/** 客诉补偿：给用户补发赠送积分，挂工单号溯源。返回新增的账本分录。 */
export async function compensate(payload: CompensatePayload): Promise<LedgerEntry> {
  return apiFetch<LedgerEntry>(`${BASE}/compensate`, { method: "POST", body: payload });
}
