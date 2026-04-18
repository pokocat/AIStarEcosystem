// ─────────────────────────────────────────────────────────────────────────────
// artist.ts — 艺人（虚拟 IP）核心领域模型。
// 以前端设计为唯一事实源（Figma：AI 艺人孵化操作系统 v3）。
// 与 apps/web/src/types/contracts/singers.ts 的差异：本平台把 Singer 归为
// Artist 的一种子类型（ArtistType = "singer"），故本模型比 SingerDetail 更宽。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime, Rarity } from "./_shared";

// ── 艺人分类（7 类） ──────────────────────────────────────────────────────────
export type ArtistType =
  | "singer"
  | "actor"
  | "entertainer"
  | "dancer"
  | "host"
  | "all_rounder"
  | "idol";

/** 艺人品质 = 通用稀有度。别名便于业务侧阅读。 */
export type ArtistQuality = Rarity;

/** 艺人生命周期状态 */
export type ArtistStatus = "trainee" | "debut" | "active" | "rest" | "retired";

// ── 六维才艺 ──────────────────────────────────────────────────────────────────
export interface TalentProfile {
  singing: number;  // 声乐
  acting: number;   // 演技
  dancing: number;  // 舞蹈
  hosting: number;  // 主持
  comedy: number;   // 喜剧
  variety: number;  // 综艺
}

export type TalentKey = keyof TalentProfile;

// ── 艺人业务统计 ──────────────────────────────────────────────────────────────
// 数值字段全部按 product_spec.md §3.1 存原始整型，展示侧由 lib/format.ts 处理。
export interface ArtistStats {
  songs: number;                 // 已发行歌曲数
  dramas: number;                // 已参演剧集数
  ads: number;                   // 已接广告数
  variety: number;               // 综艺上节数
  /** 粉丝数（原始整数）。展示请用 formatCompactNumber()。 */
  fans: number;
  /** 总收益（积分原始值）。展示请用 formatCredits()。 */
  revenue: number;
  /** 月度收益（积分原始值） */
  monthlyRevenue: number;
  /** 人气值 0–100 */
  popularity: number;
}

// ── 艺人（核心实体） ──────────────────────────────────────────────────────────
export interface Artist {
  id: ID;
  name: string;
  type: ArtistType;
  quality: ArtistQuality;
  status: ArtistStatus;
  level: number;
  exp: number;
  maxExp: number;
  avatar: string;                // 头像 URL
  talents: TalentProfile;
  stats: ArtistStats;
  createdAt: ISODateTime;
  lastActive: ISODateTime;
  bio: string;
  /** 艺人主营领域 ID 列表（见 constants/domains-8.ts） */
  domains: string[];
  /** 商业代言数（个） */
  endorsements: number;
  /** 商业价值（credits 原始值）。展示请用 formatCredits()。 */
  commercialValue: number;
  /** 所属工作室 ID（可选） */
  studioId?: ID;
  /** 拥有者账户 ID */
  ownerUserId?: ID;
  /** 最后更新时间 */
  updatedAt?: ISODateTime;
}
