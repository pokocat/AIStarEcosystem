// ─────────────────────────────────────────────────────────────────────────────
// api/reconciliation.ts — 对账视图（v2 §9 资金面 lane / §11）。
// 对应 AdminReconciliationController（GET /api/admin/finance/reconciliation）。
// 只读重算：现金勾稽（排除影子）+ 积分负债单列 + drift 告警（不自动消解）。
// 单位均为积分。限 FINANCE_ADMIN / SUPER_ADMIN。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from "./_client";

export interface ReconciliationReport {
  // 资金面（真实现金，排除影子）
  grossRecharge: number;
  refundedReclaimed: number;
  withdrawn: number;
  netCashCredits: number;
  // 勾稽
  ledgerRechargeNonShadow: number;
  drift: number;
  balanced: boolean;
  // 影子（剔除，透明）
  shadowRecharge: number;
  // 积分面负债
  giftIssued: number;
  adjustNet: number;
  licenseGranted: number;
  creditLiability: number;
  generatedAt: string;
}

/** 重算对账报表（限财务 / 超管）。 */
export async function report(): Promise<ReconciliationReport> {
  return apiFetch<ReconciliationReport>("/admin/finance/reconciliation");
}
