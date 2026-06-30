// 素材库 — 设计真源 v4:统一素材源(人物/场景/道具,图片+视频),
// 素材库页与视频工厂 @ 参考、脚本 [参考N] 引用共用。
export interface Material {
  id: string;
  name: string;
  /** 类型标签:人物 / 场景 / 道具 / 其他 */
  cat: string;
  kind: "image" | "video";
  from: string;
  to: string;
  tags?: string[];
  /** v0.89：真实素材图 URL（上传 / 生成）。有则卡片渲染真图，否则用 from/to 渐变占位。 */
  url?: string;
  /** v0.89：OSS key（真值；URL 为派生展示值）。 */
  cdnKey?: string;
}

export const MAT_CATS: { key: string }[] = [
  { key: "人物" },
  { key: "场景" },
  { key: "道具" },
  { key: "其他" },
];

// 素材库不再 seed 占位素材：早期这里塞了一批 from/to 渐变色块（AVATAR_LIBRARY / SCENE_LIB /
// 道具样例），全无真实图片，却对所有用户可见（打包在前端，本地无缓存即显示）—— 误导且无用。
// 现默认空库：只展示用户真实上传（有 url / cdnKey，经 DramaAssetsApi 落 OSS）的素材。
export const MATERIALS_SEED: Material[] = [];

/** 运行时可变素材池(素材库增删改会同步到 @ 参考面板;默认空，仅用户上传后填充) */
export let MATERIALS: Material[] = [];

export function setMaterials(next: Material[]) {
  MATERIALS = next;
}

/** 素材库 localStorage 真源键（与 assets/page.tsx 保持一致）。 */
export const ASSETS_STORAGE_KEY = "aistareco.web-drama.assets.v1";

/**
 * v0.89：把一张新素材收进「用户自己的素材库」（内存 MATERIALS + localStorage）。
 * 角色 / 场景上传参考图后调用 —— 素材库页下次进入即可见，视频工厂 @ 参考也能引用。
 */
export function addLibraryMaterial(m: Material) {
  MATERIALS = [m, ...MATERIALS.filter((x) => x.id !== m.id)];
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ASSETS_STORAGE_KEY);
    const list: Material[] = raw ? (JSON.parse(raw) as Material[]) : MATERIALS_SEED.map((x) => ({ ...x }));
    const next = [m, ...(Array.isArray(list) ? list.filter((x) => x.id !== m.id) : [])];
    window.localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 存储失败不阻塞上传主流程 */
  }
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
