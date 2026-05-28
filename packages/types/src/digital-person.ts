// ─────────────────────────────────────────────────────────────────────────────
// digital-person.ts — AI 数字人中心（形象模型 + 声音模型 + 文案驱动生成）。
// 来源：figma mcn/DigitalPersonHub.tsx（P0 新增页面，制作工坊子 tab）。
//
// 关键业务规则：
//   1. 模型类型：appearance（形象） / voice（声音）；同一 partner 可有多个模型
//   2. 模型状态：active / training / frozen / review；frozen 不可生成
//   3. 生成必须绑定已通过三阶段审核的文案（copy.stage === "approved"）
//   4. 生成产出走质量审核（quality_score < 75 自动 review，>= 90 自动 approved）
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate } from "./_shared";

export type PersonModelType = "appearance" | "voice";

export type PersonModelStatus = "active" | "training" | "frozen" | "review";

export type GenTaskStatus =
  | "generating"
  | "review"
  | "approved"
  | "failed"
  | "in_pool";

export interface PersonModel {
  id: ID;
  name: string;
  /** 合作主体显示名（partnerId 暂用名字） */
  partnerName: string;
  type: PersonModelType;
  status: PersonModelStatus;
  /** 模型版本（如 "V3.2"） */
  version: string;
  /** 综合质量分 0..100 */
  quality: number;
  /** 关联授权合同（content-license.title） */
  authContract: string;
  usageCount: number;
  /** 最近一次使用日期；从未用为 "-" */
  lastUsed: string;
  /** 主题色 hex */
  color: string;
  tags: string[];
}

export interface DigitalPersonGenTask {
  id: ID;
  modelId: ID;
  /** 冗余字段，避免 join */
  modelName: string;
  partnerName: string;
  /** 关联的文案标题（copy.title） */
  copyTitle: string;
  /** 目标平台代码 */
  platform: string;
  status: GenTaskStatus;
  /** 视频时长（秒；生成中或失败为 0） */
  duration: number;
  createdAt: ISODate;
  assignee: string;
  /** AI 质量分 0..100；null = 未评估 */
  qualityScore: number | null;
  /** 问题清单（如「口型同步度偏低」「文案含风险词」） */
  issues: string[];
}

export interface CreateGenTaskInput {
  appearanceModelId: ID;
  voiceModelId: ID;
  /** 必须是 copy.stage === "approved" 的 id；server 端校验 */
  copyId: ID;
  platform: string;
}
