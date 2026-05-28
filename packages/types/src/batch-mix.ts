// ─────────────────────────────────────────────────────────────────────────────
// batch-mix.ts — 混剪批量生产台（模板 + 素材槽配置 + 批量渲染）。
// 来源：figma mcn/BatchMixStudio.tsx（P1 新增页面，制作工坊子 tab）。
//
// 关键业务规则：
//   1. 模板定义素材槽（slots）数 + 平台 + 时长范围
//   2. 每个槽接 video / image / text / audio；text 槽必须绑已审通过的文案
//   3. 批量任务 = 模板 + 素材矩阵 + 数量（10/20/50/100）→ 渲染队列
//   4. 渲染完成可一键「批量入发布池」
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type MixTemplateType =
  | "product_review"
  | "lifestyle"
  | "tutorial"
  | "highlight"
  | "story";

export type BatchRenderStatus = "pending" | "rendering" | "done" | "failed";

export type MixSlotKind = "video" | "image" | "text" | "audio";

export interface MixTemplate {
  id: ID;
  name: string;
  type: MixTemplateType;
  /** 时长范围字符串（如 "0:45-1:20"；MVP 不强约束格式） */
  duration: string;
  /** 适用平台代码 */
  platforms: string[];
  /** 素材槽数 */
  slots: number;
  /** 模板描述 */
  description: string;
  usageCount: number;
  /** 历史成功率 0..100 */
  successRate: number;
  /** 主题色 hex */
  color: string;
}

export interface MixSlot {
  id: ID;
  /** 槽位中文标签（如 "开场片段 (0-5s)"） */
  label: string;
  kind: MixSlotKind;
  filled: boolean;
  /** 已填内容的素材标题 / 文案标题 */
  content?: string;
}

export interface BatchTask {
  id: ID;
  name: string;
  templateId: ID;
  /** 冗余字段 */
  templateName: string;
  /** 批量产出总数 */
  totalCount: number;
  completedCount: number;
  failedCount: number;
  status: BatchRenderStatus;
  /** 开始时间；未开始为 "-" */
  startedAt: string;
  /** 预计完成时间；未开始为 null */
  estimatedDone: ISODateTime | null;
  partnerName: string;
}

export interface CreateBatchTaskInput {
  name: string;
  templateId: ID;
  /** 槽位填充配置：slotId → 素材 ID / 文案 ID */
  slotBindings: Record<ID, ID>;
  /** 批量数量（推荐 10 / 20 / 50 / 100） */
  count: number;
}
