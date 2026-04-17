// ─────────────────────────────────────────────────────────────────────────────
// coach.ts — 发行机构（Coach / Agency）领域类型。
// 覆盖：签约艺人、发行队列、版权审核、多来源营收、分类分布。
// 与 types/artist.ts 的 Artist 不同：SignedArtist 聚焦合同/分成/MCN 视角，
// 展示字段以预格式化文案为主（MVP 阶段前后端一致）。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

// ── 签约艺人 ──────────────────────────────────────────────────────────────────
export type SignedArtistStatus = "active" | "negotiating" | "expiring";

export interface SignedArtist {
  id: ID;
  name: string;
  /** 艺人自由文本类型，如 "Singer" / "Idol" / "Actor" */
  type: string;
  /** 类型对应的 emoji */
  typeIcon: string;
  avatar: string;
  /** MCN 机构名 */
  mcn: string;
  /** 合同到期日 */
  contractEnd: ISODate;
  /** 月营收展示文案（如 "¥61,000"） */
  monthlyRevenue: string;
  /** 累计营收展示文案 */
  totalRevenue: string;
  /** 粉丝数展示文案（如 "162K"） */
  fans: string;
  status: SignedArtistStatus;
  /** 分成率（百分比整数） */
  royaltyRate: number;
  /** 内容数量 */
  contentCount: number;
}

// ── 营收（四来源月度） ────────────────────────────────────────────────────────
export interface CoachRevenuePoint {
  /** 月份展示文案（"1月" …） */
  month: string;
  streaming: number;
  endorsement: number;
  nft: number;
  live: number;
}

// ── 发行队列 ──────────────────────────────────────────────────────────────────
export type DistributionItemStatus = "reviewing" | "approved" | "distributing";
export type DistributionItemType = "Music" | "Video" | "Live";

export interface DistributionQueueItem {
  id: ID;
  title: string;
  /** 艺人名字 */
  artist: string;
  type: DistributionItemType;
  status: DistributionItemStatus;
  /** 目标平台数 */
  platforms: number;
  date: ISODate;
}

// ── 版权审核 ──────────────────────────────────────────────────────────────────
export type CopyrightStatus = "pending" | "verified";

export interface CopyrightItem {
  id: ID;
  title: string;
  artist: string;
  /** 自由文本类型，如 "Music" / "Choreography" / "Script" */
  type: string;
  submitted: ISODate;
  status: CopyrightStatus;
}

// ── 分类占比（饼图） ─────────────────────────────────────────────────────────
export interface CoachCategoryDistribution {
  name: string;
  /** 百分比 0–100 */
  value: number;
  color: string;
}

// ── 艺人筛选 ──────────────────────────────────────────────────────────────────
export type CoachArtistFilter = "all" | SignedArtistStatus;

// ── 侧边栏页 ID ───────────────────────────────────────────────────────────────
export type CoachPage =
  | "overview"
  | "artists"
  | "distribution"
  | "finance"
  | "copyright"
  | "settings";
