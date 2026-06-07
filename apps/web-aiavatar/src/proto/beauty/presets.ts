"use client";
// ============================================================
// 美颜参数模型 + 预设（一键美颜三档 / 滤镜）
//   端上确定性美颜：参数 → BeautyEngine（WebGL）实时渲染。
//   与 data.ts 的 WARP_CTRLS（脸型/眼睛/鼻梁/嘴型/下巴，-50..50）对齐。
// ============================================================

export type WarpParams = { face: number; eye: number; nose: number; mouth: number; chin: number };
export type SkinParams = { smooth: number; whiten: number }; // 0..100
export type FilterKey = "none" | "natural" | "fair" | "warm" | "cool" | "film" | "mono";

export type BeautyParams = {
  warp: WarpParams;
  skin: SkinParams;
  filter: FilterKey;
};

export const ZERO_WARP: WarpParams = { face: 0, eye: 0, nose: 0, mouth: 0, chin: 0 };
export const ZERO_PARAMS: BeautyParams = {
  warp: { ...ZERO_WARP },
  skin: { smooth: 0, whiten: 0 },
  filter: "none",
};

export function cloneParams(p: BeautyParams): BeautyParams {
  return { warp: { ...p.warp }, skin: { ...p.skin }, filter: p.filter };
}

export function isZeroParams(p: BeautyParams): boolean {
  return (
    Object.values(p.warp).every((v) => v === 0) &&
    p.skin.smooth === 0 &&
    p.skin.whiten === 0 &&
    p.filter === "none"
  );
}

/** 美颜（皮肤）滑杆字典。 */
export const SKIN_CTRLS: { key: keyof SkinParams; name: string; min: number; max: number }[] = [
  { key: "smooth", name: "磨皮", min: 0, max: 100 },
  { key: "whiten", name: "美白", min: 0, max: 100 },
];

/** 一键美颜三档（参数包 = 几何 + 皮肤；滤镜不动，由用户单独选）。 */
export const BEAUTY_PRESETS: { key: string; name: string; desc: string; warp: WarpParams; skin: SkinParams }[] = [
  { key: "light", name: "轻度", desc: "微调 · 几乎无痕", warp: { face: -5, eye: 4, nose: 0, mouth: 0, chin: 0 }, skin: { smooth: 25, whiten: 12 } },
  { key: "std", name: "标准", desc: "日常上镜推荐", warp: { face: -12, eye: 9, nose: 6, mouth: 0, chin: 0 }, skin: { smooth: 45, whiten: 28 } },
  { key: "deep", name: "重度", desc: "明显瘦脸大眼", warp: { face: -22, eye: 16, nose: 10, mouth: -4, chin: 5 }, skin: { smooth: 65, whiten: 45 } },
];

/**
 * 滤镜 = 全图调色参数（shader 内统一公式），新增滤镜只需加一行。
 *   temp: 色温（+暖 −冷） tint: 绿洋红  sat: 饱和  con: 对比  bri: 亮度  fade: 褪色提黑  mono: 去色
 */
export type FilterGrade = { temp: number; tint: number; sat: number; con: number; bri: number; fade: number; mono: number };

export const FILTERS: { key: FilterKey; name: string; grade: FilterGrade }[] = [
  { key: "none", name: "原图", grade: { temp: 0, tint: 0, sat: 0, con: 0, bri: 0, fade: 0, mono: 0 } },
  { key: "natural", name: "自然", grade: { temp: 0.02, tint: 0, sat: 0.08, con: 0.06, bri: 0.02, fade: 0, mono: 0 } },
  { key: "fair", name: "白皙", grade: { temp: -0.04, tint: 0.01, sat: -0.04, con: 0.02, bri: 0.08, fade: 0.04, mono: 0 } },
  { key: "warm", name: "暖阳", grade: { temp: 0.1, tint: -0.01, sat: 0.1, con: 0.05, bri: 0.04, fade: 0, mono: 0 } },
  { key: "cool", name: "冷调", grade: { temp: -0.1, tint: 0.02, sat: 0.02, con: 0.08, bri: 0, fade: 0, mono: 0 } },
  { key: "film", name: "胶片", grade: { temp: 0.04, tint: 0.02, sat: -0.12, con: 0.1, bri: 0, fade: 0.12, mono: 0 } },
  { key: "mono", name: "黑白", grade: { temp: 0, tint: 0, sat: 0, con: 0.12, bri: 0.02, fade: 0.06, mono: 1 } },
];

export function gradeOf(key: FilterKey): FilterGrade {
  return (FILTERS.find((f) => f.key === key) || FILTERS[0]).grade;
}

/** 生成版本备注（中文，落 server 版本时间线）。 */
export function describeParams(p: BeautyParams): string {
  const zh: Record<string, string> = { face: "脸型", eye: "眼睛", nose: "鼻梁", mouth: "嘴型", chin: "下巴" };
  const parts: string[] = [];
  (Object.keys(p.warp) as (keyof WarpParams)[]).forEach((k) => {
    const v = p.warp[k];
    if (v !== 0) parts.push(`${zh[k]} ${v > 0 ? "+" : ""}${v}`);
  });
  if (p.skin.smooth > 0) parts.push(`磨皮 ${p.skin.smooth}`);
  if (p.skin.whiten > 0) parts.push(`美白 ${p.skin.whiten}`);
  if (p.filter !== "none") {
    const f = FILTERS.find((x) => x.key === p.filter);
    if (f) parts.push(`滤镜·${f.name}`);
  }
  return parts.length ? `精调 · ${parts.join(" / ")}` : "精调";
}
