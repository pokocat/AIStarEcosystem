// ─────────────────────────────────────────────────────────────────────────────
// api/adjustments.ts — 运营调差 / 赠送 + maker-checker（v2 §9 积分面）。
// 对应 AdminCreditOpsController（/api/admin/finance/adjustments）。
// 只发赠送积分（giftBalance），结构上不碰资金面；强制原因，补偿强制工单号。
// 小额直发，大额（> 阈值）落审批单，需 FINANCE_ADMIN / SUPER_ADMIN 复核（maker≠checker）。
// ─────────────────────────────────────────────────────────────────────────────

import type { LedgerEntry } from "@/types/wallet";
import { apiFetch } from "./_client";

const BASE = "/admin/finance/adjustments";

/** 发起结果：pending=true → 进审批；false → 已直接发放（entry 有值）。 */
export interface AdjustmentResult {
  pending: boolean;
  entry?: LedgerEntry;
  requestId?: string;
  amount: number;
  message: string;
}

export type AdjustmentType = "compensate" | "grant";
export type AdjustmentRequestStatus = "pending_approval" | "approved" | "rejected";

export interface CreditAdjustmentRequest {
  id: string;
  type: AdjustmentType;
  targetUserId: string;
  amount: number;
  reason?: string;
  incidentRef?: string;
  campaignId?: string;
  status: AdjustmentRequestStatus;
  makerId: string;
  checkerId?: string;
  ledgerEntryId?: string;
  decideNote?: string;
  createdAt: string;
  decidedAt?: string;
}

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

/** 激励赠送（小额直发 / 大额进审批）。 */
export async function grant(payload: GrantPayload): Promise<AdjustmentResult> {
  return apiFetch<AdjustmentResult>(`${BASE}/grant`, { method: "POST", body: payload });
}

/** 客诉补偿（小额直发 / 大额进审批）。 */
export async function compensate(payload: CompensatePayload): Promise<AdjustmentResult> {
  return apiFetch<AdjustmentResult>(`${BASE}/compensate`, { method: "POST", body: payload });
}

/** 审批队列（默认全部；可传 pending_approval / approved / rejected）。 */
export async function listRequests(status?: AdjustmentRequestStatus | "all"): Promise<CreditAdjustmentRequest[]> {
  return apiFetch<CreditAdjustmentRequest[]>(`${BASE}/requests`, {
    query: status && status !== "all" ? { status } : undefined,
  });
}

/** 批准（限 FINANCE_ADMIN / SUPER_ADMIN；服务端校验 maker≠checker）。 */
export async function approveRequest(id: string): Promise<CreditAdjustmentRequest> {
  return apiFetch<CreditAdjustmentRequest>(`${BASE}/requests/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

/** 驳回（限 FINANCE_ADMIN / SUPER_ADMIN）。 */
export async function rejectRequest(id: string, note?: string): Promise<CreditAdjustmentRequest> {
  return apiFetch<CreditAdjustmentRequest>(`${BASE}/requests/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: { note },
  });
}
