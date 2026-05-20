// 混剪专区 UI 常量（从 mixcut/frontend/lib/types.ts 末段剥离）
// 与 constants/celebrity-zone-ui.ts 对称：枚举映射、tone 颜色、文案配套。

import type {
  Tier,
  PerturbationProfile,
  LayerType,
  FillStrategy,
} from "@/components/mixcut-zone/types";

export const TIER_LABELS: Record<Tier, string> = {
  trial: "体验版",
  basic: "基础版",
  standard: "标准版",
  professional: "专业版",
  annual_pro: "年度专业版",
  city_agent: "城市代理",
};

export const TIER_COLORS: Record<Tier, string> = {
  trial: "muted",
  basic: "secondary",
  standard: "default",
  professional: "brand",
  annual_pro: "brand",
  city_agent: "warning",
};

export const PROFILE_LABELS: Record<PerturbationProfile, string> = {
  light: "轻度差异",
  moderate: "适中差异",
  aggressive: "高强差异",
};

export const PROFILE_DESCRIPTIONS: Record<PerturbationProfile, string> = {
  light: "颜色和速度做小幅微调,画面看起来几乎一样,出片最快。适合追求「看上去像同一条」的批量场景。",
  moderate: "每条会做轻微的画面翻转、颜色调整和位置微调,既保证出片量、又能在平台算法面前显得是不同视频。推荐档。",
  aggressive: "画面变化幅度最大,差异度最高,平台最不容易判重;但偶尔会牺牲一点观感,适合对去重要求极高的账号。",
};

// ── 内容类型 / 填充方式 / 画面处理算子 友好标签 ─────────────────────────────
// 给运营看的中文映射;原始 enum 仅在数据层流转,UI 全部走这里。

export const LAYER_LABELS: Record<LayerType, string> = {
  video: "视频",
  image: "图片",
  text: "文字",
  audio: "音频",
};

export const FILL_STRATEGY_LABELS: Record<FillStrategy, string> = {
  fixed: "系统固定",
  library_select: "从素材库选",
  user_upload: "自己上传",
  user_input: "手动填写",
  api_generated: "AI 生成",
  variable_binding: "跟随变量",
  picgen_text: "AI 文字图",
};

// 后端 applied_transforms 返回的算子键 → 中文标签 + 单位/格式化
export const TRANSFORM_LABELS: Record<string, string> = {
  crop: "裁剪",
  mirror: "左右翻转",
  speed: "速度",
  brightness: "亮度",
  saturation: "色彩",
  segments: "片段拼接",
  overlay_count: "贴图数",
  overlay_source: "贴图来源",
  audio_source: "音轨来源",
  canvas_w: "画面宽",
  canvas_h: "画面高",
  variant: "版本号",
};

// 槽位 binding source → 友好描述前缀
export const BINDING_SOURCE_LABELS: Record<string, string> = {
  input: "手填文字",
  library: "素材库",
  upload: "自己上传",
  fixed: "系统固定",
  picgen: "AI 文字图",
};
