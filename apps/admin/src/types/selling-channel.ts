// ─────────────────────────────────────────────────────────────────────────────
// selling-channel.ts (admin 镜像) — v0.36 销售渠道 / 售卖主体
// 与 packages/types/src/selling-channel.ts 同名字段同语义。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type SellingChannelType =
  | "direct"
  | "agent"
  | "online_store"
  | "event"
  | "partner";

export type SellingChannelStatus = "active" | "inactive";

export interface SellingChannel {
  id: ID;
  code: string;
  name: string;
  sellingEntity?: string;
  type: SellingChannelType;
  contactEmail?: string;
  contactPhone?: string;
  remark?: string;
  status: SellingChannelStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * v0.53（审计 #8）：补镜像 —— 与 packages/types/src/selling-channel.ts 的
 * SellingChannelUpsertInput 同名字段同语义（之前 admin api 用 Partial<SellingChannel>
 * 充当入参，会把 id/createdAt 等只读字段也标成可传）。
 */
export interface SellingChannelUpsertInput {
  code?: string;
  name?: string;
  sellingEntity?: string | null;
  type?: SellingChannelType;
  contactEmail?: string | null;
  contactPhone?: string | null;
  remark?: string | null;
  status?: SellingChannelStatus;
}

export const SELLING_CHANNEL_TYPE_LABEL: Record<SellingChannelType, string> = {
  direct: "平台直营",
  agent: "代销",
  online_store: "电商店铺",
  event: "线下活动",
  partner: "合作渠道",
};
