// ─────────────────────────────────────────────────────────────────────────────
// finance.ts — 财务展示类型（图表 / 业务交易视图）。
// 钱包余额与流水的「事实数据」在 wallet.ts；此处只承载展示侧聚合视图。
// 所有金额一律原始数值（credits），格式化由 lib/format.ts 完成。
// 见 product_spec.md §1.4 / §3.1。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate, ISODateTime } from "./_shared";

// ── 业务交易（前端展示用，源自 wallet.LedgerEntry 的派生） ────────────────────

export type TransactionStatus = "completed" | "pending" | "processing";
export type TransactionType =
  | "income"
  | "withdrawal"
  | "spend"
  | "recharge"
  | "license_grant";

export interface Transaction {
  id: ID;
  /** 来源/描述（中性文案，前端可本地化） */
  source: string;
  /** 原始数值（credits）；正数=入账，负数=出账 */
  amount: number;
  date: ISODate;
  /** v0.58：精确到秒的创建时间（date 仅到天，保留兼容） */
  createdAt?: ISODateTime;
  status: TransactionStatus;
  type: TransactionType;
  /** 账户持有人 id（可选，用于多账户视图） */
  userId?: ID;
  /** v0.58：账号登录名（admin 结算中心视图由 server 回填） */
  username?: string;
  /** v0.58：账号昵称（同上） */
  displayName?: string;
}

// ── 月度收益曲线（数值原始，单位 credits） ────────────────────────────────────

export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
}

// ── 收益来源占比（饼图） ──────────────────────────────────────────────────────

export interface RevenueSource {
  name: string;
  /** 百分比 0–100，原始数值 */
  value: number;
  color: string;
}
