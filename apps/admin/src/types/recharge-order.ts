// ─────────────────────────────────────────────────────────────────────────────
// types/recharge-order.ts — 充值订单（v0.56）。
// 与 packages/types/src/wallet.ts RechargeOrder 同字段（admin 侧镜像）。
// ─────────────────────────────────────────────────────────────────────────────

export type RechargeOrderStatus = "pending" | "paid" | "rejected" | "cancelled" | "refunded";

export const RECHARGE_ORDER_STATUS_LABEL: Record<RechargeOrderStatus, string> = {
  pending: "待确认",
  paid: "已到账",
  rejected: "已驳回",
  cancelled: "已取消",
  refunded: "已退款",
};

export interface RechargeOrder {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  studioName?: string;
  packageId: string;
  packageTag?: string;
  credits: number;
  bonusCredits: number;
  priceCents: number;
  status: RechargeOrderStatus;
  userNote?: string;
  reviewerId?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string;
  // v2 §15.5 / D17 退款回收（仅 refunded 订单有值）
  refundedAt?: string;
  refundedCredits?: number;
  refundLedgerEntryId?: string;
}
