// ─────────────────────────────────────────────────────────────────────────────
// notification-ui.ts — 通知类型图标 + 颜色映射。
// ─────────────────────────────────────────────────────────────────────────────

import { AlertCircle, Heart, Music, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import type { NotificationType } from "@ai-star-eco/types/notification";

export interface NotificationTypeStyle {
  icon: LucideIcon;
  color: string;
  bg: string;
}

export const NOTIFICATION_ICON_MAP: Record<NotificationType, NotificationTypeStyle> = {
  revenue:     { icon: TrendingUp,  color: "text-green-400",  bg: "bg-green-500/10" },
  fan:         { icon: Heart,       color: "text-pink-400",   bg: "bg-pink-500/10" },
  content:     { icon: Music,       color: "text-cyan-400",   bg: "bg-cyan-500/10" },
  system:      { icon: AlertCircle, color: "text-amber-400",  bg: "bg-amber-500/10" },
  achievement: { icon: Zap,         color: "text-purple-400", bg: "bg-purple-500/10" },
};
