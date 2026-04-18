// ─────────────────────────────────────────────────────────────────────────────
// coach-ui.ts — 发行机构端 UI 静态配置：侧边栏、状态色、标签、图标。
// ─────────────────────────────────────────────────────────────────────────────

import {
  LayoutDashboard,
  Users,
  Send,
  BarChart3,
  Shield,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type {
  CoachArtistFilter,
  CoachPage,
  CopyrightStatus,
  DistributionItemStatus,
  DistributionItemType,
  SignedArtistStatus,
} from "@/types/coach";

// ── 侧边栏 ────────────────────────────────────────────────────────────────────
export interface CoachSidebarItem {
  id: CoachPage;
  icon: LucideIcon;
  label: string;
}

export const COACH_SIDEBAR_ITEMS: CoachSidebarItem[] = [
  { id: "overview",     icon: LayoutDashboard, label: "发行总览" },
  { id: "artists",      icon: Users,           label: "签约艺人" },
  { id: "distribution", icon: Send,            label: "发行队列" },
  { id: "finance",      icon: BarChart3,       label: "财务中心" },
  { id: "copyright",    icon: Shield,          label: "版权审核" },
  { id: "settings",     icon: Settings,        label: "设置" },
];

// ── 签约艺人状态色 & 文案 ────────────────────────────────────────────────────
export const SIGNED_ARTIST_STATUS_COLORS: Record<SignedArtistStatus, string> = {
  active:      "bg-green-500/10 text-green-400",
  expiring:    "bg-red-500/10 text-red-400",
  negotiating: "bg-amber-500/10 text-amber-400",
};

export const SIGNED_ARTIST_STATUS_LABELS: Record<SignedArtistStatus, string> = {
  active:      "活跃",
  expiring:    "即将到期",
  negotiating: "洽谈中",
};

export const COACH_ARTIST_FILTERS: CoachArtistFilter[] = [
  "all",
  "active",
  "expiring",
  "negotiating",
];

export const COACH_ARTIST_FILTER_LABELS: Record<CoachArtistFilter, string> = {
  all:         "全部",
  active:      "活跃",
  expiring:    "即将到期",
  negotiating: "洽谈中",
};

// ── 发行队列状态色（含边框版与无边框版） ───────────────────────────────────
export const DISTRIBUTION_STATUS_COLORS: Record<DistributionItemStatus, string> = {
  approved:     "bg-green-500/10 text-green-400",
  distributing: "bg-cyan-500/10 text-cyan-400",
  reviewing:    "bg-amber-500/10 text-amber-400",
};

export const DISTRIBUTION_STATUS_BORDER_COLORS: Record<DistributionItemStatus, string> = {
  approved:     "bg-green-500/10 text-green-400 border-green-500/20",
  distributing: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  reviewing:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export const DISTRIBUTION_STATUS_LABELS: Record<DistributionItemStatus, string> = {
  approved:     "已批准",
  distributing: "分发中",
  reviewing:    "审核中",
};

// ── 发行内容类型 → emoji ─────────────────────────────────────────────────────
export const DISTRIBUTION_TYPE_ICONS: Record<DistributionItemType, string> = {
  Music: "🎵",
  Video: "🎬",
  Live:  "📺",
};

// ── 版权状态 ──────────────────────────────────────────────────────────────────
export const COPYRIGHT_STATUS_COLORS: Record<CopyrightStatus, string> = {
  verified: "bg-green-500/10 text-green-400",
  pending:  "bg-amber-500/10 text-amber-400",
};

export const COPYRIGHT_STATUS_LABELS: Record<CopyrightStatus, string> = {
  verified: "已确权",
  pending:  "待审核",
};

// ── 营收柱状图图例 ───────────────────────────────────────────────────────────
export interface CoachRevenueLegendItem {
  color: string;
  label: string;
  dataKey: "streaming" | "endorsement" | "nft" | "live";
}

export const COACH_REVENUE_LEGEND: CoachRevenueLegendItem[] = [
  { color: "#06b6d4", label: "流媒体", dataKey: "streaming"   },
  { color: "#a855f7", label: "代言",   dataKey: "endorsement" },
  { color: "#ec4899", label: "NFT",    dataKey: "nft"         },
  { color: "#f59e0b", label: "演出",   dataKey: "live"        },
];

// ── 设置页静态行 ─────────────────────────────────────────────────────────────
export interface CoachSettingsRow {
  label: string;
  value: string;
}

export const COACH_SETTINGS_ROWS: CoachSettingsRow[] = [
  { label: "机构名称",   value: "星际娱乐" },
  { label: "默认分成率", value: "15%" },
  { label: "合同模板",   value: "3个模板" },
  { label: "结算周期",   value: "月结" },
];
