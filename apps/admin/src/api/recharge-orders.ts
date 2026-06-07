// ─────────────────────────────────────────────────────────────────────────────
// api/recharge-orders.ts — Admin 充值订单核销（v0.56）。
// 对应 AdminRechargeOrderController（/api/admin/finance/recharge-orders）。
// 用户下单生成 PENDING 账单 → 运营线下收款后 approve 入账 / reject 驳回。
// ─────────────────────────────────────────────────────────────────────────────

import type { RechargeOrder, RechargeOrderStatus } from "@/types/recharge-order";
import { apiFetch } from "./_client";

const BASE = "/admin/finance/recharge-orders";

/** 列出充值订单。可选 status 过滤（pending / paid / rejected / cancelled / all）。 */
export async function list(status?: RechargeOrderStatus | "all"): Promise<RechargeOrder[]> {
  return apiFetch<RechargeOrder[]>(BASE, { query: status && status !== "all" ? { status } : undefined });
}

/** 核准入账：确认线下已收款 → 经不可变账本入账，订单转 PAID。 */
export async function approve(id: string, note?: string): Promise<RechargeOrder> {
  return apiFetch<RechargeOrder>(`${BASE}/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: { note },
  });
}

/** 驳回：收款不符 / 无效订单。reason 必填。 */
export async function reject(id: string, reason: string): Promise<RechargeOrder> {
  return apiFetch<RechargeOrder>(`${BASE}/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: { reason },
  });
}
