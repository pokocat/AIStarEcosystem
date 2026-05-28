// ─────────────────────────────────────────────────────────────────────────────
// clip-studio.ts — 真人切片制作台。
// 来源：figma mcn/ClipStudio.tsx（P0 新增页面，制作工坊子 tab）。
//
// 关键业务规则：
//   1. 6 项强制质检（黑屏/字幕/画幅/敏感词/品牌露出/授权范围），全过才可入池
//   2. 切片源类型：直播回放 / 长视频 / 采访
//   3. 切片必须绑定授权合同（authContract）+ 已审通过的文案（copyVersion）
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

export type ClipTaskStatus =
  | "in_progress"
  | "quality_check"
  | "review"
  | "completed"
  | "failed";

export type ClipSourceType = "live" | "long_video" | "interview";

export type ClipStatus =
  | "pending_check"
  | "check_passed"
  | "check_failed"
  | "watermarked"
  | "in_pool";

/** 6 项强制质检项；passed: true=通过 / false=未通过 / null=未检测 */
export interface QualityCheck {
  id: string;
  label: string;
  passed: boolean | null;
}

export interface ClipTask {
  id: ID;
  /** 源视频标题（直播标题 / 长视频名 / 采访场次） */
  sourceTitle: string;
  sourceType: ClipSourceType;
  /** 合作主体显示名 */
  partnerName: string;
  /** 商品范围（与文案 productScope 对齐） */
  productScope: string;
  status: ClipTaskStatus;
  totalClips: number;
  passedClips: number;
  failedClips: number;
  assignee: string;
  createdAt: ISODate;
  deadline: ISODate;
  /** 关联的授权合同名（content-license.title） */
  authContract: string;
  /** 关联的文案版本（copy.id + version，显示为 "V3"） */
  copyVersion: string;
}

export interface Clip {
  id: ID;
  taskId: ID;
  title: string;
  /** 单切片时长（秒） */
  duration: number;
  status: ClipStatus;
  platform: string;
  qualityChecks: QualityCheck[];
}

export interface CreateClipTaskInput {
  sourceTitle: string;
  sourceType: ClipSourceType;
  partnerName: string;
  productScope: string;
  assignee: string;
  deadline: ISODate;
  authContract: string;
  copyVersion: string;
}
