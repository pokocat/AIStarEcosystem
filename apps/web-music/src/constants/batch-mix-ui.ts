// ─────────────────────────────────────────────────────────────────────────────
// batch-mix-ui.ts — 混剪批量 UI 配置：模板类型 / 渲染状态 / 槽位类型图标。
// ─────────────────────────────────────────────────────────────────────────────

import {
  Video,
  Image,
  Music,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type {
  MixTemplateType,
  BatchRenderStatus,
  MixSlotKind,
} from "@ai-star-eco/types/batch-mix";

export const MIX_TEMPLATE_TYPE_CONFIG: Record<MixTemplateType, { label: string }> = {
  product_review: { label: "产品测评" },
  lifestyle:      { label: "生活方式" },
  tutorial:       { label: "教程" },
  highlight:      { label: "精彩集锦" },
  story:          { label: "故事线" },
};

export const RENDER_STATUS_CONFIG: Record<
  BatchRenderStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  pending:   { label: "待渲染", color: "text-gray-400",    bg: "bg-gray-500/10",    border: "border-gray-500/20" },
  rendering: { label: "渲染中", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25" },
  done:      { label: "已完成", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  failed:    { label: "失败",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25" },
};

export const MIX_SLOT_KIND_ICON: Record<MixSlotKind, LucideIcon> = {
  video: Video,
  image: Image,
  audio: Music,
  text:  FileText,
};
