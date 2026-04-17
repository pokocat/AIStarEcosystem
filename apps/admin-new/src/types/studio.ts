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

  // ── admin 侧聚合指标（只读，由后端计算） ──
  artistCount: number;       // 名下艺人数
  songCount: number;         // 名下歌曲数
  totalRevenueCredits: number; // 累计收益 (credits)
  monthlyRevenueCredits: number; // 当月收益 (credits)
}
