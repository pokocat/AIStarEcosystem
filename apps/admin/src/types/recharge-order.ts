// ─────────────────────────────────────────────────────────────────────────────
// types/recharge-order.ts — 充值订单（v0.56）。
// 与 packages/types/src/wallet.ts RechargeOrder 同字段（admin 侧镜像）。
// ─────────────────────────────────────────────────────────────────────────────

export type RechargeOrderStatus = "pending" | "paid" | "rejected" | "cancelled" | "closed" | "refunded";

export const RECHARGE_ORDER_STATUS_LABEL: Record<RechargeOrderStatus, string> = {
  pending: "待支付",
  paid: "已到账",
  rejected: "已驳回",
  cancelled: "已取消",
  closed: "已超时关闭",
  refunded: "已退款",
};

/** v2 §6 支付来源（paidVia）展示元数据。manual=线下核准；jeepay/shadow=在线（影子仅 dev/test）。 */
export const RECHARGE_PAID_VIA_META: Record<string, { label: string; online: boolean }> = {
  manual: { label: "线下核准", online: false },
  jeepay: { label: "在线 · Jeepay", online: true },
  alipay: { label: "在线 · 支付宝", online: true },
  wechat: { label: "在线 · 微信", online: true },
  shadow: { label: "在线 · 影子", online: true },
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
  // v2 §6 在线支付（Jeepay/影子）可见性（线下/未支付字段省略）
  paidVia?: "manual" | "jeepay" | "shadow" | string;
  channelPayNo?: string;
  wayCode?: string;
  payOrderId?: string;
  paidAt?: string;
  sourceApp?: string;
  // v2 §15.5 / D17 退款回收（仅 refunded 订单有值）
  refundedAt?: string;
  refundedCredits?: number;
  refundLedgerEntryId?: string;
}
