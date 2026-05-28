// ─────────────────────────────────────────────────────────────────────────────
// copy.ts — 文案库（标题 / 口播稿 / 字幕稿 / 评论引导 / 商品卖点）。
// 来源：figma mcn/CopyVault.tsx（P0 新增页面，素材中心子 tab）。
//
// 关键业务规则（specs/BUSINESS_RULES.md §copy 待补）：
//   1. 三阶段审批：ops_review → partner_review → legal_review → approved | rejected
//   2. approved 状态会自动锁定版本（content immutable）
//   3. 禁用词检测：发布前扫描 riskFlags，命中即标 rejected
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODate, ISODateTime } from "./_shared";

export type CopyType = "title" | "script" | "caption" | "comment" | "selling_point";

export type CopyApprovalStage =
  | "draft"
  | "ops_review"
  | "partner_review"
  | "legal_review"
  | "approved"
  | "rejected";

export interface CopyComment {
  /** 审批阶段中文名（"运营初审" / "合作方复审" / "法务终审"） */
  stage: string;
  author: string;
  text: string;
  /** ISO 时间；处理中时为空字符串 */
  time: string;
  passed: boolean;
}

export interface CopyItem {
  id: ID;
  title: string;
  type: CopyType;
  /** 文案正文 */
  content: string;
  stage: CopyApprovalStage;
  /** 合作主体显示名 */
  partnerScope: string;
  /** 适用平台代码：DY / KS / XHS / VCH / BL / 微博 */
  platformScope: string[];
  /** 商品 / 服务范围（用于绑定品牌商务的 product） */
  productScope: string;
  validFrom: ISODate;
  validTo: ISODate;
  version: number;
  author: string;
  createdAt: ISODate;
  comments: CopyComment[];
  /** 禁用词命中列表（如 "全球首发", "史上最低价"） */
  riskFlags: string[];
}

export interface CreateCopyInput {
  title: string;
  type: CopyType;
  content: string;
  partnerScope: string;
  platformScope: string[];
  productScope: string;
  validFrom: ISODate;
  validTo: ISODate;
}

export interface CopyApproveInput {
  /** 当前审批阶段；后端校验当前 stage 是否匹配 */
  stage: Exclude<CopyApprovalStage, "draft" | "approved" | "rejected">;
  passed: boolean;
  text: string;
}

/** 审批步骤可视化配置（3 步流程） */
export interface CopyApprovalStep {
  key: "ops_review" | "partner_review" | "legal_review";
  label: string;
}
