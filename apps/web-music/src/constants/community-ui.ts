// ─────────────────────────────────────────────────────────────────────────────
// community-ui.ts — 粉丝社区 UI 侧图标/颜色映射（不是 mock 数据）。
// ─────────────────────────────────────────────────────────────────────────────

import {
  CalendarDays, Gift, Heart, MessageCircle, Share2,
  ThumbsUp, Trophy, UserPlus, type LucideIcon,
} from "lucide-react";
import type {
  CommunityEventStatus,
  CommunityEventType,
  FanActionType,
} from "@ai-star-eco/types/community";

export const EVENT_ICONS: Record<CommunityEventType, LucideIcon> = {
  meetup: Heart,
  vote: ThumbsUp,
  challenge: Trophy,
  anniversary: CalendarDays,
};

export interface EventStatusStyle {
  label: string;
  color: string;
  bg: string;
  dot: string;
}

export const EVENT_STATUS_STYLES: Record<CommunityEventStatus, EventStatusStyle> = {
  live:     { label: "进行中",   color: "text-green-400", bg: "bg-green-500/10", dot: "bg-green-400 animate-pulse" },
  upcoming: { label: "即将开始", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  ended:    { label: "已结束",   color: "text-gray-400",  bg: "bg-gray-500/10",  dot: "bg-gray-500" },
};

export const ACTION_ICONS: Record<FanActionType, LucideIcon> = {
  comment: MessageCircle,
  gift: Gift,
  share: Share2,
  follow: UserPlus,
};

export const ACTION_COLORS: Record<FanActionType, string> = {
  comment: "text-blue-400",
  gift: "text-amber-400",
  share: "text-green-400",
  follow: "text-pink-400",
};
