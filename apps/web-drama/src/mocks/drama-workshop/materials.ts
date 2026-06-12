// 素材库 — 设计真源 v4:统一素材源(人物/场景/道具,图片+视频),
// 素材库页与视频工厂 @ 参考、脚本 [参考N] 引用共用。
import { AVATAR_LIBRARY, SCENE_LIB } from "./meta";

export interface Material {
  id: string;
  name: string;
  /** 类型标签:人物 / 场景 / 道具 / 其他 */
  cat: string;
  kind: "image" | "video";
  from: string;
  to: string;
  tags?: string[];
}

export const MAT_CATS: { key: string }[] = [
  { key: "人物" },
  { key: "场景" },
  { key: "道具" },
  { key: "其他" },
];

export const MATERIALS_SEED: Material[] = [
  ...AVATAR_LIBRARY.map((a) => ({ ...a, cat: "人物", kind: "image" as const })),
  ...SCENE_LIB.map((a) => ({ ...a, cat: "场景", kind: "image" as const, tags: ["场景参考"] })),
  { id: "mv1", name: "雨夜街道空镜", cat: "场景", kind: "video", from: "#475569", to: "#0f172a", tags: ["空镜", "夜"] },
  { id: "mp1", name: "复古座钟",     cat: "道具", kind: "image", from: "#b45309", to: "#78350f", tags: ["复古", "室内"] },
  { id: "mp2", name: "血色匕首",     cat: "道具", kind: "image", from: "#b91c1c", to: "#450a0a", tags: ["悬疑", "特写"] },
  { id: "mv2", name: "人物转身参考", cat: "人物", kind: "video", from: "#f97316", to: "#fb923c", tags: ["运镜", "参考"] },
];

/** 运行时可变素材池(素材库增删改会同步到 @ 参考面板;演示态内存即真源) */
export let MATERIALS: Material[] = MATERIALS_SEED.map((m) => ({ ...m }));

export function setMaterials(next: Material[]) {
  MATERIALS = next;
}

export function matById(id: string): Material | null {
  return MATERIALS.find((m) => m.id === id) ?? null;
}

/** 素材在项目中的关联使用(演示数据) */
export const ASSET_USAGE: Record<string, { p: string; role: string; n: number }[]> = {
  a1: [{ p: "落地窗后", role: "林夏 · 女主", n: 18 }],
  a4: [{ p: "落地窗后", role: "顾沉舟 · 男主", n: 12 }],
  a6: [{ p: "重生后她在冷宫杀疯了", role: "沈昭 · 贵妃", n: 26 }],
  r1: [{ p: "落地窗后", role: "女主公寓 · 主场景", n: 9 }],
  r2: [{ p: "落地窗后", role: "街头夜戏", n: 4 }],
};
