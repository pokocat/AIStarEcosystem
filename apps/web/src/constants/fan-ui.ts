// ─────────────────────────────────────────────────────────────────────────────
// fan-ui.ts — 粉丝端 UI 静态配置（稀有度配色 / 底部导航 / 分类筛选）。
// ─────────────────────────────────────────────────────────────────────────────

import { Home, TrendingUp, Gem, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Rarity } from "@/types/_shared";
import type { FanTab } from "@/types/fan";

export interface RarityStyle {
  color: string;
  bg: string;
  border: string;
}

export const RARITY_STYLES: Record<Rarity, RarityStyle> = {
  common:    { color: "text-gray-400",   bg: "bg-gray-500/10",   border: "border-gray-600/30" },
  rare:      { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30" },
  epic:      { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  legendary: { color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30" },
};

export interface FanNavItem {
  id: FanTab;
  icon: LucideIcon;
  label: string;
}

export const FAN_NAV_ITEMS: FanNavItem[] = [
  { id: "home",    icon: Home,        label: "发现" },
  { id: "charts",  icon: TrendingUp,  label: "排行" },
  { id: "market",  icon: Gem,         label: "NFT" },
  { id: "profile", icon: User,        label: "我的" },
];

export const CHART_TABS: string[] = ["播放量", "涨粉榜", "新人榜"];

export const NFT_CATEGORY_TABS: string[] = ["全部", "徽章", "时刻", "艺术品"];
