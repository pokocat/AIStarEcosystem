// ─────────────────────────────────────────────────────────────────────────────
// selling-channel.ts — 激活码批次的销售渠道 / 售卖主体（v0.36）
//
// 替代 LicenseBatch.issuerTenantId 的 Tenant 关联（与 MCN 概念解耦）。
// 内部可见；用于 admin 财务对账与运营统计，不暴露给用户端。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type SellingChannelType =
  | "direct"        // 平台直营
  | "agent"         // 代销
  | "online_store"  // 第三方电商店铺
  | "event"         // 线下活动
  | "partner";      // 合作渠道（如外部销售平台）

export type SellingChannelStatus = "active" | "inactive";

export interface SellingChannel {
  id: ID;
  /** 内部短码（唯一），如 "platform-self" / "agent-xingmeng" */
  code: string;
  /** 显示名（内部可见） */
  name: string;
  /** 售卖主体真实名称（财务对账用） */
  sellingEntity?: string;
  type: SellingChannelType;
  contactEmail?: string;
  contactPhone?: string;
  remark?: string;
  status: SellingChannelStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

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
