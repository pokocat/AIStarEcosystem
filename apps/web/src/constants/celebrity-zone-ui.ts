// ─────────────────────────────────────────────────────────────────────────────
// celebrity-zone-ui.ts — 明星专区：UI 文案 / 引擎元数据 / 视觉常量。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityAuthStatus,
  CelebrityCategory,
  CelebrityEngine,
  CelebrityProjectStatus,
  CreativeTendency,
  EngineMeta,
  ProjectVideoStatus,
  TemplateStyle,
  CelebrityVideoDuration,
} from "@/types/celebrity-zone";

// 引擎元数据（顺序即列表展示顺序：经济 → 标准 → 高级）
// 引擎元数据（顺序即列表展示顺序：经济 → 标准 → 高级）
//   cost         = 占套餐额度的「条数」（套餐扣减用，与积分单价解耦）
//   creditPrice  = 单条视频积分单价（前端从后端 /celebrity/engine-pricing 拉取，
//                  USE_MOCK 时直接用此处常量）
export const ENGINE_META: Record<CelebrityEngine, EngineMeta> = {
  KeLing: {
    name: "KeLing",
    level: "经济",
    cost: 1,
    creditPrice: 50,
    speed: "~5分钟",
    quality: 3,
    desc: "性价比高，适合日常内容批量生成。",
    color: "#22c55e",
  },
  HiGen: {
    name: "HiGen",
    level: "标准",
    cost: 2,
    creditPrice: 120,
    speed: "~3分钟",
    quality: 4,
    desc: "效果稳定，口型同步好，推荐大多数场景。",
    color: "#06b6d4",
  },
  MiniMax: {
    name: "MiniMax",
    level: "高级",
    cost: 3,
    creditPrice: 300,
    speed: "~4分钟",
    quality: 5,
    desc: "最佳画质和表现力，适合重要投放内容。",
    color: "#fbbf24",
  },
};

export const ENGINE_ORDER: CelebrityEngine[] = ["KeLing", "HiGen", "MiniMax"];

export const TEMPLATE_STYLES: Array<"全部" | TemplateStyle> = [
  "全部",
  "种草安利",
  "硬核测评",
  "轻松开箱",
  "直播切片",
  "剧情植入",
];

export const CATEGORY_FILTERS: Array<"全部" | CelebrityCategory> = [
  "全部",
  "演员",
  "歌手",
  "主持人",
  "运动员",
  "网红",
  "综艺",
];

export const DURATION_OPTIONS: CelebrityVideoDuration[] = [15, 30, 60];

export const CREATIVE_TENDENCIES: CreativeTendency[] = [
  "不限制",
  "偏搞笑",
  "偏温馨",
  "偏专业",
  "偏潮流",
  "偏反转",
];

// 视觉常量：模式选择卡的强调色
export const MODE_ACCENT = {
  template: "#06b6d4", // cyan
  blindbox: "#a855f7", // purple
} as const;

// 模板风格 → 颜色映射
export const STYLE_BADGE_CLASS: Record<TemplateStyle, string> = {
  种草安利: "border-purple-400/30 text-purple-300 bg-purple-500/5",
  硬核测评: "border-cyan-400/30 text-cyan-300 bg-cyan-500/5",
  轻松开箱: "border-amber-400/30 text-amber-300 bg-amber-500/5",
  直播切片: "border-pink-400/30 text-pink-300 bg-pink-500/5",
  剧情植入: "border-emerald-400/30 text-emerald-300 bg-emerald-500/5",
};

// 类目 → 颜色映射（演员/歌手/主持人/运动员/网红/综艺）
export const CATEGORY_BADGE_CLASS: Record<CelebrityCategory, string> = {
  演员: "border-purple-400/30 text-purple-300 bg-purple-500/5",
  歌手: "border-cyan-400/30 text-cyan-300 bg-cyan-500/5",
  主持人: "border-amber-400/30 text-amber-300 bg-amber-500/5",
  运动员: "border-emerald-400/30 text-emerald-300 bg-emerald-500/5",
  网红: "border-pink-400/30 text-pink-300 bg-pink-500/5",
  综艺: "border-rose-400/30 text-rose-300 bg-rose-500/5",
};

// ── 授权状态四态元数据 ──────────────────────────────────────────────────────
export type AuthTone = "success" | "warning" | "danger" | "muted";

export interface AuthStatusMeta {
  label: string;
  tone: AuthTone;
  /** lucide 图标 key */
  icon: "ShieldCheck" | "Clock" | "ShieldAlert" | "Lock";
  hint: string;
  /** 横幅主标题 */
  title: string;
  /** 横幅说明 */
  description: string;
  /** Tailwind 配色（边框 + 背景） */
  bannerClass: string;
  badgeClass: string;
}

export const AUTH_STATUS_META: Record<CelebrityAuthStatus, AuthStatusMeta> = {
  authorized: {
    label: "已授权",
    tone: "success",
    icon: "ShieldCheck",
    hint: "授权有效，可生成视频",
    title: "授权有效",
    description: "您可在授权范围内使用该明星形象生成 AI 带货视频。",
    bannerClass: "border-emerald-400/30 bg-emerald-500/[0.06]",
    badgeClass: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  },
  pending: {
    label: "审核中",
    tone: "warning",
    icon: "Clock",
    hint: "授权审核中，暂不可生成",
    title: "授权审核中",
    description: "平台正在与艺人/经纪团队确认授权细节，请稍候。审核通过后您将收到站内通知。",
    bannerClass: "border-amber-400/30 bg-amber-500/[0.06]",
    badgeClass: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  },
  expired: {
    label: "已过期",
    tone: "danger",
    icon: "ShieldAlert",
    hint: "授权已过期，请尽快续约",
    title: "授权已过期",
    description: "授权已到期，续约后即可继续使用。续约不影响已发布视频的线上状态。",
    bannerClass: "border-rose-400/30 bg-rose-500/[0.05]",
    badgeClass: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  },
  unauthorized: {
    label: "未授权",
    tone: "muted",
    icon: "Lock",
    hint: "尚未对您授权",
    title: "该明星形象暂未对您授权",
    description:
      "AI 明星专区遵循「真人授权 × AI 视频生成」原则，未经授权不可生成视频。您可以申请商务合作（适合品牌批量授权）或购买体验版套餐（按条计费，平台代为洽谈）。",
    bannerClass: "border-cyan-400/30 bg-gradient-to-r from-cyan-500/[0.07] to-purple-500/[0.06]",
    badgeClass: "border-white/15 bg-white/[0.04] text-white/55",
  },
};

// ── 项目状态色 ─────────────────────────────────────────────────────────────
export const PROJECT_STATUS_BADGE: Record<
  CelebrityProjectStatus,
  { color: string; className: string }
> = {
  进行中: {
    color: "#06b6d4",
    className: "border-cyan-400/40 bg-cyan-500/10 text-cyan-300",
  },
  筹备中: {
    color: "#f59e0b",
    className: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  },
  已完成: {
    color: "#22c55e",
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  },
};

// 项目视频状态色
export const VIDEO_STATUS_BADGE: Record<
  ProjectVideoStatus,
  { color: string; className: string }
> = {
  已发布: {
    color: "#22c55e",
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  },
  待审核: {
    color: "#f59e0b",
    className: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  },
  生成中: {
    color: "#06b6d4",
    className: "border-cyan-400/40 bg-cyan-500/10 text-cyan-300",
  },
  已驳回: {
    color: "#ef4444",
    className: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  },
};

// 顶部 5 Tab key（与 ?tab= query 对应）
export const ZONE_TABS = [
  { id: "market", label: "明星市场" },
  { id: "projects", label: "我的项目" },
  { id: "products", label: "商品库" },
  { id: "library", label: "视频库" },
  { id: "data", label: "数据中心" },
] as const;
export type ZoneTabId = (typeof ZONE_TABS)[number]["id"];
