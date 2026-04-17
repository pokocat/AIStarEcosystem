// ─────────────────────────────────────────────────────────────────────────────
// finance.ts — 财务 / 收益 / 交易流水。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

export type TransactionStatus = "completed" | "pending" | "processing";
export type TransactionType = "income" | "withdrawal";

export interface Transaction {
  id: ID;
  /** 来源/描述（中文，前端展示用） */
  source: string;
  /** 金额文案：正数以 "+¥..." / 负数以 "-¥..." 前缀展示 */
  amount: string;
  date: ISODate;
  status: TransactionStatus;
  type: TransactionType;
}

export interface MonthlyRevenuePoint {
  month: string;    // "1月" / "Jan" 等展示文案
  revenue: number;  // 原始数值
}

export interface RevenueSource {
  /** 来源名（中文） */
  name: string;
  /** 百分比占比 0–100 */
  value: number;
  /** 饼图色值 */
  color: string;
}

export interface WalletSummary {
  /** 总余额展示文案（如 "¥128,500"） */
  totalBalance: string;
  /** 结算中金额文案 */
  pendingAmount: string;
  /** 月度环比变化（展示文案，如 "+12%"） */
  monthChange?: string;
}
