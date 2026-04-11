// ─────────────────────────────────────────────────────────────────────────────
// analytics.ts — 与 specs/openapi.yaml 对齐，一切以 BACKEND_API_SPEC.md 为准
// ─────────────────────────────────────────────────────────────────────────────

import type { DistributionConfiguration } from "@/types/contracts/distribution";
import type { MarketplaceArtist } from "@/types/contracts/marketplace";

// ── 2.12 Finance ─────────────────────────────────────────────────────────────

export type TransactionType =
  | "royalty"
  | "nftSale"
  | "tip"
  | "signingFee"
  | "withdrawal"
  | "aiCredit"
  | "distribution"
  | "platformFee";

export type TransactionDirection = "in" | "out";

export type TransactionStatus = "pending" | "completed" | "failed";

/** 交易记录（原始数据，含实际金额） */
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  direction: TransactionDirection;
  amount: number;          // 金额，精度2位
  currency: string;        // 默认 "CNY"
  status: TransactionStatus;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

/** 账户余额 */
export interface WalletBalance {
  userId: string;
  available: number;
  pending: number;
  totalEarned: number;
  currency: string;
  updatedAt: string;
}

// ── 2.13 收益统计图表 ─────────────────────────────────────────────────────────

/**
 * 收益趋势数据点。
 * 字段名与后端对齐：period / songRevenue / badgeRevenue
 */
export interface EarningDataPoint {
  period: string;       // 时间周期标识，如 "2026-W14"、"2026-04"、"1"~"7"
  songRevenue: number;  // 流媒体版税收益
  badgeRevenue: number; // NFT勋章收益
}

/** 总览仪表盘统计（KPI卡片数据） */
export interface DashboardStats {
  userId: string;
  ecoValue: number;          // 生态估值（元），显示为 "¥1.25M"
  estimatedRoyalty: number;  // 预估版税（元）
  badgeHolders: number;
  totalStreams: number;
  totalFans: number;
  updatedAt: string;
}

// ── Dashboard Metrics（制作人/掌门人 KPI 汇总）────────────────────────────────

export interface DashboardMetrics {
  artistCount: number;
  totalPlays: number;
  marketSignings: number;
  revenueCny: number;
  newSongs: number;
  successRate: number;
  pendingReviews: number;
}

// ── 2.21 Coach / Trainee ─────────────────────────────────────────────────────

/**
 * 学员状态枚举——与后端 TraineeStatus 对齐。
 * active=活跃 | inactive=暂停 | graduated=已毕业
 */
export type TraineeStatus = "active" | "inactive" | "graduated";

/** 掌门人-学员关系记录 */
export interface CoachTrainee {
  id: string;
  coachId: string;
  traineeId: string;
  status: TraineeStatus;
  revenueSharePct: number; // 掌门人从学员收益中的分成比例 0–100
  joinedAt: string;
  updatedAt: string;
}

/** 学员 KPI 数据（列表展示用） */
export interface TraineeKPI {
  traineeId: string;
  username: string;
  avatarUrl: string;
  status: TraineeStatus;
  weeklySongs: number;
  weeklyProgress: number;   // 0–100
  weeklyRevenue: number;    // 元
  successRate: number;      // 0–100
  pendingReviews: number;
  weekStart: string;        // ISO 日期
}

/** 作品提交审核记录 */
export interface SubmissionReview {
  id: string;
  coachId: string;
  traineeId: string;
  trackId: string;
  status: "pending" | "approved" | "rejected";
  reviewComment: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

// ── Analytics Dashboard Payload ──────────────────────────────────────────────

export interface AnalyticsDashboardPayload {
  producerMetrics: DashboardMetrics;
  coachMetrics: DashboardMetrics;
  earningsSeries: EarningDataPoint[];
  transactions: Transaction[];
  marketListings: MarketplaceArtist[];
  coachTrainees: TraineeKPI[];
  distribution: DistributionConfiguration;
}
