// ─────────────────────────────────────────────────────────────────────────────
// copy-ui.ts — 文案库 UI 配置：类型 / 三阶段审批 色板 + 图标。
// ─────────────────────────────────────────────────────────────────────────────

import { Users, Star, Shield, type LucideIcon } from "lucide-react";
import type { CopyType, CopyApprovalStage } from "@ai-star-eco/types/copy";

export const COPY_TYPE_CONFIG: Record<CopyType, { label: string; color: string; bg: string }> = {
  title:         { label: "标题",      color: "text-cyan-400",   bg: "bg-cyan-500/10" },
  script:        { label: "口播稿",    color: "text-purple-400", bg: "bg-purple-500/10" },
  caption:       { label: "字幕稿",    color: "text-blue-400",   bg: "bg-blue-500/10" },
  comment:       { label: "评论引导",  color: "text-pink-400",   bg: "bg-pink-500/10" },
  selling_point: { label: "商品卖点",  color: "text-amber-400",  bg: "bg-amber-500/10" },
};

/**
 * 审批阶段配置。`step` 用于可视化进度：
 *   0 = 草稿
 *   1 = 运营初审
 *   2 = 合作方复审
 *   3 = 法务终审
 *   4 = 已通过
 *  -1 = 已驳回（任意阶段都可能驳回）
 */
export const COPY_STAGE_CONFIG: Record<
  CopyApprovalStage,
  { label: string; color: string; bg: string; border: string; step: number }
> = {
  draft:          { label: "草稿",       color: "text-gray-500",    bg: "bg-gray-800/60",     border: "border-white/10",         step: 0 },
  ops_review:     { label: "运营初审",   color: "text-blue-400",    bg: "bg-blue-500/10",     border: "border-blue-500/25",      step: 1 },
  partner_review: { label: "合作方复审", color: "text-amber-400",   bg: "bg-amber-500/10",    border: "border-amber-500/25",     step: 2 },
  legal_review:   { label: "法务终审",   color: "text-purple-400",  bg: "bg-purple-500/10",   border: "border-purple-500/25",    step: 3 },
  approved:       { label: "已通过",     color: "text-emerald-400", bg: "bg-emerald-500/10",  border: "border-emerald-500/25",   step: 4 },
  rejected:       { label: "已驳回",     color: "text-red-400",     bg: "bg-red-500/10",      border: "border-red-500/25",       step: -1 },
};

/** 三阶段审批可视化步骤定义 */
export const APPROVAL_STEPS: {
  key: "ops_review" | "partner_review" | "legal_review";
  label: string;
  /** 中文阶段名（匹配 CopyComment.stage 字段值） */
  stageName: string;
  icon: LucideIcon;
  color: string;
}[] = [
  { key: "ops_review",     label: "运营初审",   stageName: "运营初审",   icon: Users,  color: "#3b82f6" },
  { key: "partner_review", label: "合作方复审", stageName: "合作方复审", icon: Star,   color: "#f59e0b" },
  { key: "legal_review",   label: "法务终审",   stageName: "法务终审",   icon: Shield, color: "#a855f7" },
];
