// ─────────────────────────────────────────────────────────────────────────────
// mocks/finance.ts — 短剧子产品财务样本（工作室视角）。
// 数值字段一律为原始整数（credits / 元）；展示文案由 lib/format.ts 处理。
// ─────────────────────────────────────────────────────────────────────────────

import type { MonthlyRevenuePoint, RevenueSource, Transaction } from "@ai-star-eco/types/finance";

export const REVENUE_MONTHLY: MonthlyRevenuePoint[] = [
  { month: "1 月", revenue:  28_000 },
  { month: "2 月", revenue:  32_000 },
  { month: "3 月", revenue:  45_000 },
  { month: "4 月", revenue:  38_000 },
  { month: "5 月", revenue:  52_000 },
  { month: "6 月", revenue:  61_000 },
];

export const REVENUE_SOURCES: RevenueSource[] = [
  { name: "平台分账", value: 38, color: "#06b6d4" },
  { name: "品牌合作", value: 26, color: "#a855f7" },
  { name: "衍生周边", value: 14, color: "#ec4899" },
  { name: "直播打赏", value: 10, color: "#f59e0b" },
  { name: "投资合拍", value:  8, color: "#22c55e" },
  { name: "其他",     value:  4, color: "#6366f1" },
];

export const TRANSACTIONS: Transaction[] = [
  { id: "t1", source: "《暮色未央》平台分账",  amount:  8_200,  date: "2026-04-14", status: "completed",  type: "income" },
  { id: "t2", source: "提现至银行卡",          amount: -20_000, date: "2026-04-12", status: "completed",  type: "withdrawal" },
  { id: "t3", source: "《盛夏来信》周边礼盒",  amount:  4_800,  date: "2026-04-10", status: "completed",  type: "income" },
  { id: "t4", source: "品牌合作 · 安踏儿童",   amount: 35_000,  date: "2026-04-08", status: "completed",  type: "income" },
  { id: "t5", source: "视频号创作分成",        amount:  3_200,  date: "2026-04-05", status: "processing", type: "income" },
  { id: "t6", source: "粉丝直播打赏汇总",      amount:  6_500,  date: "2026-04-03", status: "completed",  type: "income" },
  { id: "t7", source: "提现至银行卡",          amount: -15_000, date: "2026-04-01", status: "completed",  type: "withdrawal" },
  { id: "t8", source: "B 站创作激励",          amount:  2_100,  date: "2026-03-28", status: "pending",    type: "income" },
];
