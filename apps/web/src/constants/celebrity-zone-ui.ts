// ─────────────────────────────────────────────────────────────────────────────
// celebrity-zone-ui.ts — 明星专区：UI 文案 / 引擎元数据 / 视觉常量。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CelebrityEngine,
  EngineMeta,
  TemplateStyle,
  CelebrityVideoDuration,
  CreativeTendency,
} from "@/types/celebrity-zone";

// 引擎元数据（顺序即列表展示顺序：经济 → 标准 → 高级）
export const ENGINE_META: Record<CelebrityEngine, EngineMeta> = {
  KeLing: {
    name: "KeLing",
    level: "经济",
    cost: 1,
    speed: "~5分钟",
    quality: 3,
    desc: "性价比高，适合日常内容批量生成。",
    color: "#22c55e",
  },
  HiGen: {
    name: "HiGen",
    level: "标准",
    cost: 2,
    speed: "~3分钟",
    quality: 4,
    desc: "效果稳定，口型同步好，推荐大多数场景。",
    color: "#06b6d4",
  },
  MiniMax: {
    name: "MiniMax",
    level: "高级",
    cost: 3,
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

// 模板风格 → 颜色映射（仅用于次级标签视觉强调，不写死像素值，配合 tailwind 类名）
export const STYLE_BADGE_CLASS: Record<TemplateStyle, string> = {
  种草安利: "border-purple-400/30 text-purple-300 bg-purple-500/5",
  硬核测评: "border-cyan-400/30 text-cyan-300 bg-cyan-500/5",
  轻松开箱: "border-amber-400/30 text-amber-300 bg-amber-500/5",
  直播切片: "border-pink-400/30 text-pink-300 bg-pink-500/5",
  剧情植入: "border-emerald-400/30 text-emerald-300 bg-emerald-500/5",
};
