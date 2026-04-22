// ─────────────────────────────────────────────────────────────────────────────
// mocks/finance.ts — 财务展示聚合（月度曲线 / 渠道占比 / 业务交易视图）。
// 所有金额单位：credits 原始整数。
// ─────────────────────────────────────────────────────────────────────────────

import type { MonthlyRevenuePoint, RevenueSource, Transaction } from "@/types/finance";

export const REVENUE_MONTHLY: MonthlyRevenuePoint[] = [
  { month: "1月", revenue: 2_800_000 },
  { month: "2月", revenue: 3_200_000 },
  { month: "3月", revenue: 4_500_000 },
  { month: "4月", revenue: 3_800_000 },
  { month: "5月", revenue: 5_200_000 },
  { month: "6月", revenue: 6_100_000 },
];

export const REVENUE_SOURCES: RevenueSource[] = [
  { name: "流媒体版税", value: 35, color: "#06b6d4" },
  { name: "商业代言",   value: 25, color: "#a855f7" },
  { name: "数字藏品",   value: 18, color: "#ec4899" },
  { name: "粉丝打赏",   value: 12, color: "#f59e0b" },
  { name: "演出票务",   value: 7,  color: "#22c55e" },
  { name: "其他",       value: 3,  color: "#6366f1" },
];

/** 业务交易视图：基于 LedgerEntry 派生，供结算中心展示。 */
export const TRANSACTIONS: Transaction[] = [
  { id: "t1", source: "流媒体版税结算",      amount:   8_200, date: "2026-04-14", status: "completed",  type: "income",        userId: "u-001" },
  { id: "t2", source: "提现至银行卡",        amount: -20_000, date: "2026-04-12", status: "completed",  type: "withdrawal",    userId: "u-001" },
  { id: "t3", source: "数字藏品 #287 售出",  amount:   4_800, date: "2026-04-10", status: "completed",  type: "income",        userId: "u-001" },
  { id: "t4", source: "品牌代言 · 某科技",   amount:  35_000, date: "2026-04-08", status: "completed",  type: "income",        userId: "u-002" },
  { id: "t5", source: "海外视频平台广告分成", amount:   3_200, date: "2026-04-05", status: "processing", type: "income",        userId: "u-002" },
  { id: "t6", source: "粉丝打赏汇总",        amount:   6_500, date: "2026-04-03", status: "completed",  type: "income",        userId: "u-001" },
  { id: "t7", source: "提现至银行卡",        amount: -15_000, date: "2026-04-01", status: "completed",  type: "withdrawal",    userId: "u-002" },
  { id: "t8", source: "国内视频平台创作激励", amount:   2_100, date: "2026-03-28", status: "pending",    type: "income",        userId: "u-002" },
  { id: "t9", source: "入门包充值",          amount:   5_000, date: "2026-02-15", status: "completed",  type: "recharge",      userId: "u-003" },
  { id: "t10",source: "秘钥核销入账",        amount:   1_000, date: "2026-01-22", status: "completed",  type: "license_grant", userId: "u-003" },
  { id: "t11",source: "造型升级（虚拟服饰）",amount:    -800, date: "2026-04-05", status: "completed",  type: "spend",         userId: "u-005" },
];
