// ─────────────────────────────────────────────────────────────────────────────
// digital-person-ui.ts — AI 数字人 UI 配置：模型状态 / 生成任务状态。
// ─────────────────────────────────────────────────────────────────────────────

import {
  CheckCircle2,
  RefreshCw,
  Lock,
  Clock,
  Eye,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  PersonModelStatus,
  GenTaskStatus,
} from "@ai-star-eco/types/digital-person";

export const PERSON_MODEL_STATUS_CONFIG: Record<
  PersonModelStatus,
  { label: string; color: string; bg: string; border: string; icon: LucideIcon }
> = {
  active:   { label: "可用",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: CheckCircle2 },
  training: { label: "训练中", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    icon: RefreshCw },
  frozen:   { label: "已冻结", color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     icon: Lock },
  review:   { label: "审核中", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   icon: Clock },
};

export const GEN_TASK_STATUS_CONFIG: Record<
  GenTaskStatus,
  { label: string; color: string; bg: string; border: string; icon: LucideIcon }
> = {
  generating: { label: "生成中",     color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    icon: RefreshCw },
  review:     { label: "质量审核",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   icon: Eye },
  approved:   { label: "已通过",     color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: CheckCircle2 },
  failed:     { label: "生成失败",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     icon: XCircle },
  in_pool:    { label: "已入发布池", color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/25",  icon: Zap },
};

/** 质量分等级阈值（前端展示用） */
export function qualityClassFor(score: number | null): string {
  if (score === null) return "text-gray-500";
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-amber-400";
  return "text-red-400";
}
