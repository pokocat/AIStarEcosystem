// ─────────────────────────────────────────────────────────────────────────────
// mocks/finance.ts — 财务样本数据（Producer 端）。
// ─────────────────────────────────────────────────────────────────────────────

import type { MonthlyRevenuePoint, RevenueSource, Transaction } from "@/types/finance";

export const REVENUE_MONTHLY: MonthlyRevenuePoint[] = [
  { month: "1月", revenue: 28000 },
  { month: "2月", revenue: 32000 },
  { month: "3月", revenue: 45000 },
  { month: "4月", revenue: 38000 },
  { month: "5月", revenue: 52000 },
  { month: "6月", revenue: 61000 },
];

export const REVENUE_SOURCES: RevenueSource[] = [
  { name: "流媒体版税", value: 35, color: "#06b6d4" },
  { name: "商业代言",   value: 25, color: "#a855f7" },
  { name: "NFT销售",    value: 18, color: "#ec4899" },
  { name: "粉丝打赏",   value: 12, color: "#f59e0b" },
  { name: "演出票务",   value: 7,  color: "#22c55e" },
  { name: "其他",       value: 3,  color: "#6366f1" },
];

export const TRANSACTIONS: Transaction[] = [
  { id: "t1", source: "Spotify 版税结算",   amount: "+¥8,200",  date: "2025-04-14", status: "completed",  type: "income" },
  { id: "t2", source: "提现至银行卡",        amount: "-¥20,000", date: "2025-04-12", status: "completed",  type: "withdrawal" },
  { id: "t3", source: "NFT #287 售出",       amount: "+¥4,800",  date: "2025-04-10", status: "completed",  type: "income" },
  { id: "t4", source: "品牌代言 — 某科技",   amount: "+¥35,000", date: "2025-04-08", status: "completed",  type: "income" },
  { id: "t5", source: "YouTube Ad 分成",     amount: "+¥3,200",  date: "2025-04-05", status: "processing", type: "income" },
  { id: "t6", source: "粉丝打赏汇总",        amount: "+¥6,500",  date: "2025-04-03", status: "completed",  type: "income" },
  { id: "t7", source: "提现至银行卡",        amount: "-¥15,000", date: "2025-04-01", status: "completed",  type: "withdrawal" },
  { id: "t8", source: "Bilibili 创作激励",   amount: "+¥2,100",  date: "2025-03-28", status: "pending",    type: "income" },
];
