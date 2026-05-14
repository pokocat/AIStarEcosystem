// ─────────────────────────────────────────────────────────────────────────────
// mocks/finance.ts — 短剧子产品财务样本（工作室视角）。
// 数值字段一律为原始整数（credits / 元）；展示文案由 lib/format.ts 处理。
// ─────────────────────────────────────────────────────────────────────────────

import type { MonthlyRevenuePoint, RevenueSource, Transaction } from "@ai-star-eco/types/finance";

export const REVENUE_MONTHLY: MonthlyRevenuePoint[] = [
  { month: "1 月", revenue:  0 },
  { month: "2 月", revenue:  12_600 },
  { month: "3 月", revenue:  31_800 },
  { month: "4 月", revenue: 118_400 },
  { month: "5 月", revenue:  95_200 },
  { month: "6 月", revenue:  0 },
];

export const REVENUE_SOURCES: RevenueSource[] = [
  { name: "短剧平台分账", value: 46, color: "#06b6d4" },
  { name: "品牌植入",     value: 21, color: "#a855f7" },
  { name: "授权素材包",   value: 14, color: "#ec4899" },
  { name: "会员抢先看",   value: 11, color: "#f59e0b" },
  { name: "直播转化",     value:  6, color: "#22c55e" },
  { name: "其他",         value:  2, color: "#6366f1" },
];

export const TRANSACTIONS: Transaction[] = [
  { id: "t1", source: "《暮色未央》EP01-03 平台分账", amount:  24_600, date: "2026-05-13", status: "completed",  type: "income" },
  { id: "t2", source: "抖音切片广告补贴",             amount:   8_400, date: "2026-05-12", status: "completed",  type: "income" },
  { id: "t3", source: "提现至尾号 9316",               amount: -30_000, date: "2026-05-10", status: "completed",  type: "withdrawal" },
  { id: "t4", source: "晴山防晒 · 剧情植入尾款",       amount:  42_000, date: "2026-05-08", status: "completed",  type: "income" },
  { id: "t5", source: "《暮色未央》会员抢先看",         amount:  16_800, date: "2026-05-06", status: "processing", type: "income" },
  { id: "t6", source: "视频号创作分成",                 amount:   5_700, date: "2026-05-04", status: "completed",  type: "income" },
  { id: "t7", source: "《盛夏来信》先导素材授权",       amount:  12_000, date: "2026-05-02", status: "completed",  type: "income" },
  { id: "t8", source: "B 站创作激励",                   amount:   2_900, date: "2026-04-30", status: "pending",    type: "income" },
];
