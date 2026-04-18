// ─────────────────────────────────────────────────────────────────────────────
// distribution.ts — 分发：平台、作品分发状态。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

export type PlatformCategory = "music" | "video" | "social" | "live";
export type PlatformStatus = "connected" | "pending" | "disconnected";

export interface Platform {
  id: ID;
  name: string;
  icon: string; // emoji 或图标标识
  category: PlatformCategory;
  status: PlatformStatus;
  /** 粉丝数展示文案，"-" 表示未接入 */
  followers: string;
  /** 上次同步时间相对文案，如 "2min ago" */
  lastSync: string;
}

export type ContentDistributionStatus = "published" | "distributing" | "scheduled" | "draft";

export interface DistributionContentItem {
  id: ID;
  title: string;
  /** 内容类型，自由文本（"music" / "video" 等） */
  type: string;
  status: ContentDistributionStatus;
  /** 已分发到的平台数 */
  platforms: number;
  /** 累计播放量展示文案，"-" 表示暂无 */
  totalViews: string;
  date: ISODate;
}

export interface PlatformViewPoint {
  name: string;
  views: number;
}
