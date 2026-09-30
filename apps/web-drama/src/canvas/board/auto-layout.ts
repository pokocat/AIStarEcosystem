// ─────────────────────────────────────────────────────────────────────────────
// canvas/board/auto-layout.ts —— 画布的尺寸约定与自动排版（v0.198，纯函数，有单测）。
//
// 卡片一律**定宽定高**（CSS 里同一组数字，见 canvas-board.css 顶部）：
//   · 排版、分组大小、fitView 都要知道尺寸，定死了就不用等浏览器量完再排；
//   · React Flow 的节点带上 width/height/measured，打开就能显示、fitView 立刻生效（不用等 ResizeObserver）。
//
// 位置约定（CanvasBoard.positions 注释）：分组里的卡片是**相对分组左上角**的坐标；分组、素材是画布坐标。
// 自动排版只给**没有位置的**节点找位置，已有位置的一律不动：
//   · 角色分组排在左边，一行放不下就换行；组里的造型横排（初排时一行最多 4 个），新加的接在最右边；
//   · 场景分组排在所有角色分组的右边，组里的场景卡按网格排；
//   · 素材排在最下面一行。
// 同样的文档永远排出同样的结果（不依赖时间、随机数）。
// ─────────────────────────────────────────────────────────────────────────────

import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { SCENES_GROUP_ID, characterGroupId } from "@/canvas/core";

export type XY = { x: number; y: number };
export type Size = { w: number; h: number };

/**
 * 卡片尺寸。**改这里要同步改 styles/pages/canvas-board.css**（顶部注释的那组数字，以及 .cvb-look-media /
 * .cvb-scene-media / .cvb-image-media 的图高）—— 两边对不上，卡片内容就会溢出或留白。
 */
export const CARD = {
  look: { w: 176, h: 316 },
  scene: { w: 256, h: 226 },
  image: { w: 200, h: 214 },
  text: { w: 232, h: 172 },
} as const satisfies Record<string, Size>;

/** 分组：内边距、标题条高度、卡片间距、最小宽度（标题条放得下「角色名 + 主要角色 + 加一个造型」）。改这里同样要同步 canvas-board.css（.cvb-group-head 高度）。 */
export const GROUP = { pad: 14, header: 46, gap: 14, minW: 312 } as const;

/** 排版参数。 */
export const LAYOUT = {
  /** 初排时一个角色分组里一行最多几个造型。 */
  looksPerRow: 4,
  /** 角色区一行最宽多少（超过就换行）。 */
  castMaxW: 1080,
  /** 分组之间的间距。 */
  groupGap: 40,
  /** 角色区 / 场景区 / 素材区之间的间距。 */
  areaGap: 120,
  /** 素材之间的间距。 */
  materialGap: 24,
} as const;

/** 场景分组里一行几张（初排）。 */
export function sceneCols(count: number): number {
  return count <= 4 ? 2 : 3;
}

const round = (n: number) => Math.round(n);
const posEq = (a: XY | undefined, b: XY | undefined) => !!a && !!b && a.x === b.x && a.y === b.y;

// ── 分组大小 ─────────────────────────────────────────────────────────────────

/**
 * 分组的大小 = 把里面的卡片都框进去（右、下各留一个内边距）；收起时只剩标题条。
 * 卡片坐标是相对分组的；左、上超出的部分由 hugGroup 在拖完之后收拢。
 */
export function groupSize(children: { pos: XY | undefined; size: Size }[], collapsed: boolean): Size {
  let right = 0;
  let bottom = 0;
  for (const c of children) {
    if (!c.pos) continue;
    right = Math.max(right, c.pos.x + c.size.w);
    bottom = Math.max(bottom, c.pos.y + c.size.h);
  }
  const minH = GROUP.header + (children[0]?.size.h ?? 0) + GROUP.pad;
  const w = Math.max(GROUP.minW, right + GROUP.pad);
  const h = collapsed ? GROUP.header : Math.max(minH, bottom + GROUP.pad);
  return { w, h };
}

// ── 文档里有哪些节点 ─────────────────────────────────────────────────────────

interface GroupSpec {
  id: string;
  childIds: string[];
  childSize: Size;
  /** 初排（组里一个有位置的都没有）时的列数。 */
  cols: number;
  /** 追加方式：row = 接在最右边；grid = 另起一行往下排。 */
  append: "row" | "grid";
}

function groupSpecs(doc: DramaCanvasDoc): { cast: GroupSpec[]; scenes: GroupSpec | null } {
  const cast = doc.characters.map<GroupSpec>((c) => ({
    id: characterGroupId(c.id),
    childIds: c.looks.map((l) => l.id),
    childSize: CARD.look,
    cols: LAYOUT.looksPerRow,
    append: "row",
  }));
  const scenes: GroupSpec | null = doc.scenes.length
    ? {
        id: SCENES_GROUP_ID,
        childIds: doc.scenes.map((s) => s.id),
        childSize: CARD.scene,
        cols: sceneCols(doc.scenes.length),
        append: "grid",
      }
    : null;
  return { cast, scenes };
}

/** 画布上所有节点 id（分组、造型、场景、素材）。 */
export function boardNodeIds(doc: DramaCanvasDoc): string[] {
  const { cast, scenes } = groupSpecs(doc);
  const ids: string[] = [];
  for (const g of cast) ids.push(g.id, ...g.childIds);
  if (scenes) ids.push(scenes.id, ...scenes.childIds);
  for (const m of doc.materials) ids.push(m.id);
  return ids;
}

/** 有没有还没位置的节点（自动排版要不要跑）。 */
export function hasMissingPositions(doc: DramaCanvasDoc): boolean {
  const pos = doc.board.positions;
  return boardNodeIds(doc).some((id) => !pos[id]);
}

export function materialSize(kind: "image" | "text"): Size {
  return kind === "image" ? CARD.image : CARD.text;
}

// ── 排版 ─────────────────────────────────────────────────────────────────────

/** 组里没位置的卡片：初排按网格；已有卡片时按 append 规则追加。 */
function placeChildren(g: GroupSpec, pos: Record<string, XY>, put: (id: string, p: XY) => void) {
  const { w, h } = g.childSize;
  const placed = g.childIds.filter((id) => pos[id]).map((id) => pos[id]);
  if (!placed.length) {
    g.childIds.forEach((id, i) => {
      const col = i % g.cols;
      const row = Math.floor(i / g.cols);
      put(id, { x: GROUP.pad + col * (w + GROUP.gap), y: GROUP.header + row * (h + GROUP.gap) });
    });
    return;
  }
  const missing = g.childIds.filter((id) => !pos[id]);
  if (!missing.length) return;
  if (g.append === "row") {
    const top = Math.min(...placed.map((p) => p.y));
    let x = Math.max(...placed.map((p) => p.x + w)) + GROUP.gap;
    for (const id of missing) {
      put(id, { x, y: top });
      x += w + GROUP.gap;
    }
    return;
  }
  const y0 = Math.max(...placed.map((p) => p.y + h)) + GROUP.gap;
  missing.forEach((id, i) => {
    const col = i % g.cols;
    const row = Math.floor(i / g.cols);
    put(id, { x: GROUP.pad + col * (w + GROUP.gap), y: y0 + row * (h + GROUP.gap) });
  });
}

type Box = { x: number; y: number; w: number; h: number };

/** 从 (x0, y0) 起按行排一串盒子，一行宽度超过 maxW 就换行。 */
function flow(items: { id: string; size: Size }[], x0: number, y0: number, maxW: number, gap: number, put: (id: string, p: XY) => void) {
  let x = x0;
  let y = y0;
  let rowH = 0;
  for (const it of items) {
    if (x > x0 && x + it.size.w > x0 + maxW) {
      x = x0;
      y += rowH + gap;
      rowH = 0;
    }
    put(it.id, { x, y });
    x += it.size.w + gap;
    rowH = Math.max(rowH, it.size.h);
  }
}

/**
 * 给没有位置的节点排好位置：返回**只含新排的那些**（已有位置的不在里面）。
 * 什么都不缺时返回空对象。
 */
export function layoutMissing(doc: DramaCanvasDoc): Record<string, XY> {
  const pos: Record<string, XY> = { ...doc.board.positions };
  const added: Record<string, XY> = {};
  const put = (id: string, p: XY) => {
    const v = { x: round(p.x), y: round(p.y) };
    pos[id] = v;
    added[id] = v;
  };
  const collapsed = new Set(doc.board.collapsed);
  const { cast, scenes } = groupSpecs(doc);

  // 1. 分组里的卡片（相对坐标）
  for (const g of cast) placeChildren(g, pos, put);
  if (scenes) placeChildren(scenes, pos, put);

  const sizeOf = (g: GroupSpec) =>
    groupSize(
      g.childIds.map((id) => ({ pos: pos[id], size: g.childSize })),
      collapsed.has(g.id),
    );
  const boxOf = (id: string, size: Size): Box | null => (pos[id] ? { ...pos[id], w: size.w, h: size.h } : null);

  // 2. 角色分组：接在已有角色分组的下面（一个都没有就从原点开始）
  const castBoxes = () => cast.map((g) => boxOf(g.id, sizeOf(g))).filter((b): b is Box => !!b);
  const missingCast = cast.filter((g) => !pos[g.id]);
  if (missingCast.length) {
    const existing = castBoxes();
    const y0 = existing.length ? Math.max(...existing.map((b) => b.y + b.h)) + LAYOUT.groupGap : 0;
    const x0 = existing.length ? Math.min(...existing.map((b) => b.x)) : 0;
    flow(
      missingCast.map((g) => ({ id: g.id, size: sizeOf(g) })),
      x0,
      y0,
      LAYOUT.castMaxW,
      LAYOUT.groupGap,
      put,
    );
  }

  // 3. 场景分组：在所有角色分组的右边
  if (scenes && !pos[scenes.id]) {
    const boxes = castBoxes();
    const x = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) + LAYOUT.areaGap : 0;
    const y = boxes.length ? Math.min(...boxes.map((b) => b.y)) : 0;
    put(scenes.id, { x, y });
  }

  // 4. 素材：在所有东西的下面排一行
  const missingMaterials = doc.materials.filter((m) => !pos[m.id]);
  if (missingMaterials.length) {
    const boxes: Box[] = [...castBoxes()];
    if (scenes) {
      const b = boxOf(scenes.id, sizeOf(scenes));
      if (b) boxes.push(b);
    }
    for (const m of doc.materials) {
      const b = boxOf(m.id, materialSize(m.kind));
      if (b) boxes.push(b);
    }
    const y0 = boxes.length ? Math.max(...boxes.map((b) => b.y + b.h)) + LAYOUT.areaGap : 0;
    const x0 = boxes.length ? Math.min(...boxes.map((b) => b.x)) : 0;
    const right = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) : 0;
    flow(
      missingMaterials.map((m) => ({ id: m.id, size: materialSize(m.kind) })),
      x0,
      y0,
      Math.max(LAYOUT.castMaxW, right - x0),
      LAYOUT.materialGap,
      put,
    );
  }

  return added;
}

/** 所有节点的位置（已有的 + 缺的现排）。只读时画布用它显示，不写回。 */
export function resolvePositions(doc: DramaCanvasDoc): Record<string, XY> {
  const added = layoutMissing(doc);
  if (!Object.keys(added).length) return doc.board.positions;
  return { ...doc.board.positions, ...added };
}

/** 把缺的位置排好写进文档（一次写回）；什么都不缺时原样返回。 */
export function applyAutoLayout(doc: DramaCanvasDoc): DramaCanvasDoc {
  const added = layoutMissing(doc);
  if (!Object.keys(added).length) return doc;
  return { ...doc, board: { ...doc.board, positions: { ...doc.board.positions, ...added } } };
}

/** 「重新排一下」：清空所有位置再排（连线、收起状态、视口不动）。 */
export function relayoutAll(doc: DramaCanvasDoc): DramaCanvasDoc {
  const cleared = { ...doc, board: { ...doc.board, positions: {} } };
  return applyAutoLayout(cleared);
}

// ── 拖动之后 ─────────────────────────────────────────────────────────────────

/**
 * 分组「贴合」里面的卡片：让最左的卡片离分组左边正好一个内边距、最上的卡片在标题条下面。
 * 卡片拖到分组左边 / 上边外面时，分组跟着往外扩；把最左的卡片往右拖，分组也跟着收。
 * 分组移动多少，卡片的相对坐标就反向补多少 —— 卡片在画布上的位置不变。
 */
export function hugGroup(positions: Record<string, XY>, groupId: string, childIds: string[]): Record<string, XY> {
  const g = positions[groupId];
  const kids = childIds.filter((id) => positions[id]);
  if (!g || !kids.length) return positions;
  const minX = Math.min(...kids.map((id) => positions[id].x));
  const minY = Math.min(...kids.map((id) => positions[id].y));
  const dx = round(minX - GROUP.pad);
  const dy = round(minY - GROUP.header);
  if (dx === 0 && dy === 0) return positions;
  const next = { ...positions, [groupId]: { x: g.x + dx, y: g.y + dy } };
  for (const id of kids) next[id] = { x: positions[id].x - dx, y: positions[id].y - dy };
  return next;
}

/** 把一批位置写进文档（取整）；没有任何变化时原样返回。 */
export function writePositions(doc: DramaCanvasDoc, patch: Record<string, XY>): DramaCanvasDoc {
  let changed = false;
  const positions = { ...doc.board.positions };
  for (const [id, p] of Object.entries(patch)) {
    const v = { x: round(p.x), y: round(p.y) };
    if (posEq(positions[id], v)) continue;
    positions[id] = v;
    changed = true;
  }
  return changed ? { ...doc, board: { ...doc.board, positions } } : doc;
}
