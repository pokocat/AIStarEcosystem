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

/** 业务交易视图：基于 LedgerEntry 派生，供结算中心展示。v0.58：附带秒级时间 + 账号信息（u-003 故意缺省）。 */
export const TRANSACTIONS: Transaction[] = [
  { id: "t1", source: "流媒体版税结算",      amount:   8_200, date: "2026-04-14", createdAt: "2026-04-14T08:00:12Z", status: "completed",  type: "income",        userId: "u-001", username: "skywave_studio",    displayName: "星浪工作室" },
  { id: "t2", source: "提现至银行卡",        amount: -20_000, date: "2026-04-12", createdAt: "2026-04-12T03:15:46Z", status: "completed",  type: "withdrawal",    userId: "u-001", username: "skywave_studio",    displayName: "星浪工作室" },
  { id: "t3", source: "数字藏品 #287 售出",  amount:   4_800, date: "2026-04-10", createdAt: "2026-04-10T10:11:05Z", status: "completed",  type: "income",        userId: "u-001", username: "skywave_studio",    displayName: "星浪工作室" },
  { id: "t4", source: "品牌代言 · 某科技",   amount:  35_000, date: "2026-04-08", createdAt: "2026-04-08T06:40:53Z", status: "completed",  type: "income",        userId: "u-002", username: "nebula_mcn",        displayName: "星云 MCN" },
  { id: "t5", source: "海外视频平台广告分成", amount:   3_200, date: "2026-04-05", createdAt: "2026-04-05T01:50:31Z", status: "processing", type: "income",        userId: "u-002", username: "nebula_mcn",        displayName: "星云 MCN" },
  { id: "t6", source: "粉丝打赏汇总",        amount:   6_500, date: "2026-04-03", createdAt: "2026-04-03T12:08:50Z", status: "completed",  type: "income",        userId: "u-001", username: "skywave_studio",    displayName: "星浪工作室" },
  { id: "t7", source: "提现至银行卡",        amount: -15_000, date: "2026-04-01", createdAt: "2026-04-01T09:30:24Z", status: "completed",  type: "withdrawal",    userId: "u-002", username: "nebula_mcn",        displayName: "星云 MCN" },
  { id: "t8", source: "国内视频平台创作激励", amount:   2_100, date: "2026-03-28", createdAt: "2026-03-28T16:42:07Z", status: "pending",    type: "income",        userId: "u-002", username: "nebula_mcn",        displayName: "星云 MCN" },
  { id: "t9", source: "入门包充值",          amount:   5_000, date: "2026-02-15", createdAt: "2026-02-15T05:20:18Z", status: "completed",  type: "recharge",      userId: "u-003" },
  { id: "t10",source: "秘钥核销入账",        amount:   1_000, date: "2026-01-22", createdAt: "2026-01-22T12:01:44Z", status: "completed",  type: "license_grant", userId: "u-003" },
  { id: "t11",source: "造型升级（虚拟服饰）",amount:    -800, date: "2026-04-05", createdAt: "2026-04-05T02:00:39Z", status: "completed",  type: "spend",         userId: "u-005", username: "solo_creator_moka", displayName: "摩卡（个人创作者）" },
];
