// ─────────────────────────────────────────────────────────────────────────────
// asset-ui.ts — 数字资产库 UI 配置：类型 / 状态 / 授权状态 色板 + 图标。
// ─────────────────────────────────────────────────────────────────────────────

import {
  Video,
  Image,
  Music,
  Cpu,
  Layers,
  Shield,
  AlertTriangle,
  Lock,
  type LucideIcon,
} from "lucide-react";
import type { AssetType, AssetStatus, AssetAuthStatus } from "@ai-star-eco/types/asset";

export const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; icon: LucideIcon; color: string }> = {
  video:    { label: "视频",    icon: Video, color: "#06b6d4" },
  image:    { label: "图片",    icon: Image, color: "#a855f7" },
  audio:    { label: "音频",    icon: Music, color: "#ec4899" },
  model_3d: { label: "3D 模型", icon: Cpu,   color: "#10b981" },
  material: { label: "素材包",  icon: Layers, color: "#f97316" },
};

export const ASSET_STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  available: { label: "可用",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  reviewing: { label: "审核中", color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  frozen:    { label: "已冻结", color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25" },
  disputed:  { label: "争议中", color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/25" },
};

export const ASSET_AUTH_CONFIG: Record<
  AssetAuthStatus,
  { label: string; color: string; icon: LucideIcon }
> = {
  authorized: { label: "授权有效", color: "text-emerald-400", icon: Shield },
  expiring:   { label: "临期",     color: "text-amber-400",   icon: AlertTriangle },
  expired:    { label: "授权过期", color: "text-red-400",     icon: Lock },
  none:       { label: "无授权",   color: "text-gray-500",    icon: Lock },
};

/** 版本号 → 默认版本标签池（数字资产库展开视图用） */
export const ASSET_VERSION_LABELS = ["加水印版", "字幕版", "剪辑版", "原始版", "母版"] as const;
