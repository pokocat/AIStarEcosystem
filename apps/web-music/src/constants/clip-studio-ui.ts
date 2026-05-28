// ─────────────────────────────────────────────────────────────────────────────
// clip-studio-ui.ts — 切片制作 UI 配置：任务状态 / 切片源类型。
// ─────────────────────────────────────────────────────────────────────────────

import {
  Scissors,
  Shield,
  Eye,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ClipTaskStatus, ClipSourceType } from "@ai-star-eco/types/clip-studio";

export const CLIP_TASK_STATUS_CONFIG: Record<
  ClipTaskStatus,
  { label: string; color: string; bg: string; border: string; icon: LucideIcon }
> = {
  in_progress:   { label: "制作中",   color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25",    icon: Scissors },
  quality_check: { label: "质检中",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   icon: Shield },
  review:        { label: "审核中",   color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/25",  icon: Eye },
  completed:     { label: "已完成",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: CheckCircle2 },
  failed:        { label: "质检失败", color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     icon: XCircle },
};

export const CLIP_SOURCE_TYPE_CONFIG: Record<
  ClipSourceType,
  { label: string; color: string }
> = {
  live:       { label: "直播回放", color: "#ef4444" },
  long_video: { label: "长视频",   color: "#3b82f6" },
  interview:  { label: "采访",     color: "#10b981" },
};

/** 切片演示用时长池（秒），按索引依次发放给前 5 个切片 */
export const DEMO_CLIP_DURATIONS = [45, 72, 58, 90, 36] as const;
