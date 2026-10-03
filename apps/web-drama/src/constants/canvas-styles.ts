// ─────────────────────────────────────────────────────────────────────────────
// constants/canvas-styles.ts —— 画布的全剧风格列表（v0.198，docs/drama-canvas-plan.md §2.2）。
//
// 选中的风格整条写进文档（DramaCanvasDoc.style = { id, name, prompt }），服务端出图 / 出视频时把 prompt 拼进提示词。
// 没有缩略图：格子上用一条色带 + 名字（不去网上找图）。色带颜色只是示意这个风格的大致色调。
// 「无风格」prompt 为空；「自定义」由用户自己写一句。
// ─────────────────────────────────────────────────────────────────────────────

import type { CanvasStyle } from "@ai-star-eco/types/drama-canvas";

export type CanvasStyleCategory = "real" | "2d" | "3d";

export interface CanvasStyleOption {
  id: string;
  name: string;
  /** 风格提示词；none / custom 为空串（custom 由用户填）。 */
  prompt: string;
  /** 缺省 = 不归类（无风格 / 自定义，在「全部」里排最前）。 */
  category?: CanvasStyleCategory;
  /** 色带：从左到右两种颜色。 */
  band: [string, string];
}

export const CANVAS_STYLE_CATEGORIES: { key: "all" | CanvasStyleCategory; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "real", label: "真人" },
  { key: "2d", label: "2D" },
  { key: "3d", label: "3D" },
];

export const NO_STYLE_ID = "none";
export const CUSTOM_STYLE_ID = "custom";

export const CANVAS_STYLES: CanvasStyleOption[] = [
  { id: NO_STYLE_ID, name: "无风格", prompt: "", band: ["#e7e5e4", "#d6d3d1"] },
  { id: CUSTOM_STYLE_ID, name: "自定义", prompt: "", band: ["#fde68a", "#f9a8d4"] },
  { id: "film-real", name: "写实电影", prompt: "写实电影质感，自然光，35mm 镜头，轻微胶片颗粒", category: "real", band: ["#57534e", "#a8a29e"] },
  { id: "retro-90s", name: "90 年代怀旧", prompt: "90 年代港片质感，暖黄调，胶片颗粒，略低饱和", category: "real", band: ["#b45309", "#fcd34d"] },
  { id: "costume", name: "古装影棚", prompt: "中式古装影棚，布景考究，柔和顶光，服化道精致", category: "real", band: ["#7f1d1d", "#d97706"] },
  { id: "urban-fashion", name: "都市时尚", prompt: "都市时尚大片，高级灰调，构图干净利落", category: "real", band: ["#334155", "#cbd5e1"] },
  { id: "neon-night", name: "霓虹夜景", prompt: "城市夜景，霓虹灯光，潮湿的街道反光，蓝紫色调", category: "real", band: ["#312e81", "#db2777"] },
  { id: "ink", name: "国风水墨", prompt: "国风水墨画风，大量留白，淡墨晕染，宣纸质感", category: "2d", band: ["#1c1917", "#e7e5e4"] },
  { id: "jp-anime", name: "日系动画", prompt: "日系二维动画，清透配色，细线条，柔和阴影", category: "2d", band: ["#38bdf8", "#fbcfe8"] },
  { id: "cn-comic", name: "国漫厚涂", prompt: "国风漫画厚涂，色彩浓郁，光影对比强", category: "2d", band: ["#9a3412", "#0f766e"] },
  { id: "3d-cartoon", name: "3D 卡通", prompt: "3D 卡通渲染，造型圆润，配色明亮，柔和全局光", category: "3d", band: ["#f97316", "#facc15"] },
  { id: "3d-real", name: "3D 写实", prompt: "写实 3D 渲染，电影级灯光，材质细腻", category: "3d", band: ["#0f172a", "#64748b"] },
];

export const DEFAULT_CANVAS_STYLE: CanvasStyle = { id: NO_STYLE_ID, name: "无风格", prompt: "" };

/** 自定义风格提示词最多几个字（写进文档，出图时拼进提示词）。 */
export const CUSTOM_STYLE_MAX = 120;

export function findCanvasStyle(id: string): CanvasStyleOption | undefined {
  return CANVAS_STYLES.find((s) => s.id === id);
}

/** 列表里的一项 → 写进文档的风格。自定义用用户那一句（去掉首尾空白、截到上限）。 */
export function toCanvasStyle(option: CanvasStyleOption, customPrompt = ""): CanvasStyle {
  if (option.id === CUSTOM_STYLE_ID) {
    return { id: CUSTOM_STYLE_ID, name: "自定义", prompt: Array.from(customPrompt.trim()).slice(0, CUSTOM_STYLE_MAX).join("") };
  }
  return { id: option.id, name: option.name, prompt: option.prompt };
}
