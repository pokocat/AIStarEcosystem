// ─────────────────────────────────────────────────────────────────────────────
// finance.ts — 业务侧财务展示类型（图表 / 流水）。
// 注意：钱包余额与点数流水的「事实数据」定义在 wallet.ts；
// 本文件仅承载展示侧聚合（柱状图/饼图等）与「业务交易」简化视图。
// 所有金额一律为原始数值（credits 或人民币分），格式化由 lib/format.ts 完成。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

// ── 业务交易（前端展示用，源自 wallet.LedgerEntry 的派生） ────────────────────

export type TransactionStatus = "completed" | "pending" | "processing";
export type TransactionType = "income" | "withdrawal" | "spend" | "recharge" | "license_grant";

export interface Transaction {
  id: ID;
  /** 来源/描述（中性文案，前端可本地化） */
  source: string;
  /** 原始金额（credits）；正数=入账，负数=出账 */
  amount: number;
  date: ISODate;
  status: TransactionStatus;
  type: TransactionType;
  /** 账户持有人 id（可选，用于多账户视图） */
  userId?: ID;
}

// ── 月度收益曲线（数值原始） ──────────────────────────────────────────────────

export interface MonthlyRevenuePoint {
  month: string;     // 展示文案 "1月" / "Jan"
  revenue: number;   // 原始数值（credits）
}

// ── 收益来源占比（饼图） ──────────────────────────────────────────────────────

export interface RevenueSource {
  /** 来源名（中性，前端可本地化） */
  name: string;
  /** 百分比 0–100，原始数值；展示时由 formatPercent 处理 */
  value: number;
  /** 饼图色值 */
  color: string;
}
