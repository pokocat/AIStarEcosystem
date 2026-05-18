// 场景模板辅助:
//   - migrateLegacyTemplate: 旧 flat {slots:[]} → 新 {scenes:[{slots:[]}]}
//   - flatSlotsOf:           读视图(预览/创建页/快照)需要的 flat slots[]
//   - flatSlotsAbsolute:     带绝对 time_range 的 flat 列表(给后端 snapshot)
//
// 设计要点:
//   - scenes 是数据真值,slots[] 概念被淘汰
//   - 旧模板自动迁移为「单场景 = 整片」
//   - flat 视图按 scene 顺序拼接,time_range 加上各场景累计偏移

import type { Template, TemplateScene, TemplateSlot } from "../types";

/** 把旧版 flat-slots 模板兜底升级为单场景模板。新模板原样返回。 */
export function migrateLegacyTemplate(t: any): Template {
  if (!t) return t;
  if (Array.isArray(t.scenes) && t.scenes.length > 0) return t as Template;

  const slots: TemplateSlot[] = Array.isArray(t.slots) ? t.slots : [];
  const duration = t.canvas?.duration ?? Math.max(1, ...slots.map((s) => s.time_range?.[1] ?? 1));
  const scene: TemplateScene = {
    id: "scene_main",
    label: "全片",
    duration,
    slots,
  };
  const out: Template = { ...t, scenes: [scene] };
  // 清掉遗留字段,避免误读
  delete (out as any).slots;
  return out;
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
