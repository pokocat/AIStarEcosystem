// ─────────────────────────────────────────────────────────────────────────────
// studio.ts — 业务主体（经纪公司 / 工作室 / 个人创作者）档案。
// 1:1 关联到 AepUser；与后端 com.aistareco.aep.model.Studio 对齐。
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
  ownerUserId: ID;             // 1:1 → AepUser
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

/** 中文显示映射：{@link StudioKind} → 中文。 */
export const STUDIO_KIND_LABEL_ZH: Record<StudioKind, string> = {
  personal_creator: "个人创作者",
  music_studio: "音乐工作室",
  drama_studio: "短剧工作室",
  variety_studio: "综艺工作室",
  agency: "经纪公司",
  mcn: "MCN 机构",
};
