// 场景模板辅助:
//   - migrateLegacyTemplate: 旧 flat {slots:[]} → 新 {scenes:[{slots:[]}]}
//   - flatSlotsOf:           读视图(预览/创建页/快照)需要的 flat slots[]
//   - flatSlotsAbsolute:     带绝对 time_range 的 flat 列表(给后端 snapshot)
//
// 设计要点:
//   - scenes 是数据真值,slots[] 概念被淘汰
//   - 旧模板自动迁移为「单场景 = 整片」
//   - flat 视图按 scene 顺序拼接,time_range 加上各场景累计偏移

import type { LayerType, Template, TemplateScene, TemplateSlot } from "../types";

/** 把可能出现的旧 layer_type 字符串归一化到当前 4 类(video / image / text / audio)。
 *  数字人 → 视频;贴图 → 图片。其他原值不动。 */
export function normalizeLayerType(raw: string | undefined): LayerType {
  if (raw === "digital_human") return "video";
  if (raw === "sticker") return "image";
  return (raw as LayerType) ?? "image";
}

function normalizeSlotsLayerType<T extends { layer_type?: string }>(slots: T[]): T[] {
  return slots.map((s) => ({ ...s, layer_type: normalizeLayerType(s.layer_type) }));
}

/** 把旧版 flat-slots 模板兜底升级为单场景模板;同时把 layer_type 归一化到 4 类。
 *  新模板格式 + 已归一化的层类型则原样返回。 */
export function migrateLegacyTemplate(t: any): Template {
  if (!t) return t;

  // 1) flat-slots 旧结构 → 单场景包装
  if (!Array.isArray(t.scenes) || t.scenes.length === 0) {
    const slots: TemplateSlot[] = Array.isArray(t.slots) ? t.slots : [];
    const duration = t.canvas?.duration ?? Math.max(1, ...slots.map((s) => s.time_range?.[1] ?? 1));
    const scene: TemplateScene = {
      id: "scene_main",
      label: "全片",
      duration,
      slots: normalizeSlotsLayerType(slots),
    };
    const out: Template = { ...t, scenes: [scene] };
    delete (out as any).slots;
    return normalizeVideoSceneTimings(out);
  }

  // 2) 新结构:遍历 scenes.slots 做 layer_type 归一化(幂等)
  const out = {
    ...t,
    scenes: t.scenes.map((sc: TemplateScene) => ({
      ...sc,
      slots: normalizeSlotsLayerType(sc.slots ?? []),
    })),
  } as Template;
  return normalizeVideoSceneTimings(out);
}

function clampSec(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function roundSec(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * 多场景模板里,video slot 的 time_range 实际承担了"本段主视频起止"语义。
 * 把它规范化成 scene.duration,避免渲染器按旧 scene.duration 让第一段视频放完整段。
 */
export function normalizeVideoSceneTimings(template: Template): Template {
  if (!Array.isArray(template.scenes) || template.scenes.length <= 1) {
    return {
      ...template,
      canvas: { ...template.canvas, duration: totalDuration(template) },
    };
  }

  let changed = false;
  const scenes = template.scenes.map((scene) => {
    const ranges = scene.slots
      .filter((slot) => normalizeLayerType(slot.layer_type) === "video" && Array.isArray(slot.time_range))
      .map((slot) => {
        const [start, end] = slot.time_range ?? [0, scene.duration];
        return [Number(start), Number(end)] as [number, number];
      })
      .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);

    if (ranges.length === 0) return scene;

    const base = Math.min(...ranges.map(([start]) => start));
    const end = Math.max(...ranges.map(([, rangeEnd]) => rangeEnd));
    const nextDuration = Math.max(1, roundSec(end - base));
    if (Math.abs(base) < 1e-6 && Math.abs(nextDuration - scene.duration) < 1e-6) return scene;

    changed = true;
    return {
      ...scene,
      duration: nextDuration,
      slots: scene.slots.map((slot) => {
        const [start, slotEnd] = slot.time_range ?? [0, scene.duration];
        const nextStart = roundSec(clampSec(Number(start) - base, 0, nextDuration));
        const nextEnd = roundSec(clampSec(Number(slotEnd) - base, 0, nextDuration));
        const timeRange: [number, number] = nextEnd > nextStart ? [nextStart, nextEnd] : [0, nextDuration];
        return {
          ...slot,
          time_range: timeRange,
        };
      }),
    };
  });

  const next = { ...template, scenes };
  const duration = totalDuration(next);
  if (!changed && Math.abs((template.canvas.duration ?? duration) - duration) < 1e-6) return template;
  return { ...next, canvas: { ...template.canvas, duration } };
}

/** 取出 flat slot 列表(time_range 还是相对场景的)。预览/创建页用。 */
export function flatSlotsOf(template: Template): TemplateSlot[] {
  return template.scenes.flatMap((s) => s.slots);
}

/** 取出带「绝对 time_range」的 flat 列表 —— 给后端渲染快照。 */
export function flatSlotsAbsolute(template: Template): TemplateSlot[] {
  const out: TemplateSlot[] = [];
  let offset = 0;
  for (const scene of template.scenes) {
    for (const slot of scene.slots) {
      const [rs, re] = slot.time_range ?? [0, scene.duration];
      out.push({
        ...slot,
        time_range: [offset + rs, offset + re],
      });
    }
    offset += scene.duration;
  }
  return out;
}

/** 计算总时长(后端 canvas snapshot 的 duration 字段)。 */
export function totalDuration(template: Template): number {
  return template.scenes.reduce((acc, s) => acc + s.duration, 0);
}

/**
 * 解析 slot 的填充方式。默认 "cover"（带货场景下填满优先）。
 * cover = 填满裁切；contain = 完整显示，模糊背景填充 letterbox。
 */
export function resolveFit(slot: TemplateSlot): "cover" | "contain" {
  return slot.fit ?? "cover";
}

/**
 * 把画布尺寸翻成「人话」的方向 + 推荐发布场景，给标题块的 meta 行用。
 * 横竖判定带 10% 容差，避免 1080×1100 这种「准方形」被错判。
 */
export function orientationLabel(w: number, h: number): string {
  if (h > w * 1.1) return "竖屏 · 适合抖音/小红书";
  if (w > h * 1.1) return "横屏 · 适合 B 站/视频号";
  return "方形 · 适合 Feed 流";
}

/** 把模板裁到「仅第一场景」用于卡片缩略图。canvas.duration 同步收紧。 */
export function firstScenePreviewTemplate(template: Template): Template {
  const firstScene = template.scenes[0];
  if (!firstScene) return template;
  return {
    ...template,
    canvas: { ...template.canvas, duration: firstScene.duration },
    scenes: [firstScene],
  };
}
