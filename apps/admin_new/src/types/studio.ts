// ─────────────────────────────────────────────────────────────────────────────
// studio.ts — 业务主体（经纪公司 / 工作室 / 个人创作者）档案。
// 1:1 关联到 AepUser；与 apps/web_new/src/types/studio.ts 对齐。
// 见 product_spec.md §1.6。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type StudioKind =
  | "personal_creator"
  | "music_studio"
  | "drama_studio"
  | "variety_studio"
  | "agency"
  | "mcn";

export type StudioStatus = "active" | "suspended" | "deleted";

/** 基础 Studio — 与 web_new/types/studio.ts 及后端 StudioDto 对齐 */
export interface Studio {
  id: ID;
  ownerUserId: ID;
  name: string;
  kind: StudioKind;
  status: StudioStatus;
  bio?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Admin 扩展视图 — 后端 AdminStudioDto 返回的聚合指标（只读） */
export interface AdminStudio extends Studio {
  /** 账号用户名（来自 owner AepUser.username，admin 列表便利字段） */
  ownerUsername?: string;
  artistCount: number;           // 名下艺人数
  songCount: number;             // 名下歌曲数
  totalRevenueCredits: number;   // 累计收益 (credits)
  monthlyRevenueCredits: number; // 当月收益 (credits)
}
