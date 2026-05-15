// ─────────────────────────────────────────────────────────────────────────────
// notice.ts — 通告 / 商业邀约（接活墙）。
// MCN 与艺人接收的外部合作邀约：录制、影视、广告、综艺、配音、舞台、特殊活动。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";
import type { TalentKey } from "./artist";

export type NoticeType =
  | "music"
  | "film"
  | "variety"
  | "ad"
  | "voice"
  | "stage"
  | "special";

export type NoticeDifficulty = "easy" | "medium" | "hard" | "expert";

export interface NoticeRequirements {
  /** 艺人最低等级 */
  minLevel: number;
  /** 各项才艺最低分（六维 TalentProfile 的子集） */
  talents: Partial<Record<TalentKey, number>>;
  /** 经验门槛，自由文本（如「至少 2 部短剧经验」） */
  experience?: string;
}

export interface Notice {
  id: ID;
  type: NoticeType;
  title: string;
  client: string;
  description: string;
  requirements: NoticeRequirements;
  /** 主报酬（原始整数，展示由 lib/format 处理） */
  reward: number;
  /** 完成奖金，可选 */
  bonus?: number;
  difficulty: NoticeDifficulty;
  /** 截止日期 "YYYY-MM-DD" */
  deadline: ISODate;
  /** 工期描述（如 "3天"、"15天"） */
  duration: string;
  /** 总名额 */
  slots: number;
  /** 剩余名额 */
  slotsLeft: number;
  /** 热门标记（首页/筛选用） */
  hot: boolean;
  /** 精选标记（顶部高亮） */
  featured: boolean;
  tags: string[];
}
