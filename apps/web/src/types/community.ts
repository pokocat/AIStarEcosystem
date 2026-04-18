// ─────────────────────────────────────────────────────────────────────────────
// community.ts — 粉丝社区 / 活动 / 互动事件。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

// ── 粉丝等级 ──────────────────────────────────────────────────────────────────
export interface FanTier {
  name: string;
  icon: string;
  count: number;
  color: string;   // Tailwind class
  bg: string;
}

// ── 粉丝增长（时间序列） ─────────────────────────────────────────────────────
export interface FanGrowthPoint {
  date: string;    // 展示文案，如 "1月"
  fans: number;    // 累计粉丝数
  active: number;  // 活跃粉丝数
}

// ── 粉丝互动活动 ──────────────────────────────────────────────────────────────
export type FanActionType = "comment" | "gift" | "share" | "follow";

export interface FanActivity {
  id: ID;
  user: string;
  avatar: string;   // emoji 或 URL
  /** 动作描述（中文句子，如 "打赏了 ¥500"） */
  action: string;
  /** 相对时间文案，如 "2min" */
  time: string;
  type: FanActionType;
}

// ── 社区事件（投票/见面会/挑战/周年） ────────────────────────────────────────
export type CommunityEventType = "meetup" | "vote" | "challenge" | "anniversary";
export type CommunityEventStatus = "live" | "upcoming" | "ended";

export interface CommunityEvent {
  id: ID;
  title: string;
  type: CommunityEventType;
  status: CommunityEventStatus;
  participants: number;
  date: ISODate;
}
