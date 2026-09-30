// ─────────────────────────────────────────────────────────────────────────────
// canvas/board/board-ops.ts —— 画布自己用的几处文档编辑（v0.198，纯函数）：收起分组、改名、改文字、
// 删除前的确认文案、分组里的卡片、卡片在画布上的绝对位置。通用的增删（addLook / removeLook …）在 @/canvas/core。
// ─────────────────────────────────────────────────────────────────────────────

import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import {
  SCENES_GROUP_ID,
  characterGroupId,
  findCharacter,
  findLook,
  findMaterial,
  findScene,
  mapMaterial,
  mapScene,
  parseRefs,
  removeCharacter,
  removeLook,
  removeMaterial,
  removeScene,
} from "@/canvas/core";
import type { XY } from "./auto-layout";
import { characterIdOfGroup } from "./connect";

// ── 分组 ─────────────────────────────────────────────────────────────────────

export function toggleCollapsed(doc: DramaCanvasDoc, groupId: string): DramaCanvasDoc {
  const on = doc.board.collapsed.includes(groupId);
  const collapsed = on ? doc.board.collapsed.filter((id) => id !== groupId) : [...doc.board.collapsed, groupId];
  return { ...doc, board: { ...doc.board, collapsed } };
}

/** 展开一个分组（本来就展开着时原样返回）。 */
export function expandGroup(doc: DramaCanvasDoc, groupId: string): DramaCanvasDoc {
  if (!doc.board.collapsed.includes(groupId)) return doc;
  return { ...doc, board: { ...doc.board, collapsed: doc.board.collapsed.filter((id) => id !== groupId) } };
}

/** 分组里的卡片 id。 */
export function childIdsOf(doc: DramaCanvasDoc, groupId: string): string[] {
  if (groupId === SCENES_GROUP_ID) return doc.scenes.map((s) => s.id);
  const cid = characterIdOfGroup(groupId);
  const c = cid ? findCharacter(doc, cid) : null;
  return c ? c.looks.map((l) => l.id) : [];
}

/** 卡片所在的分组（素材不在分组里，返回 null）。 */
export function parentGroupOf(doc: DramaCanvasDoc, nodeId: string): string | null {
  const hit = findLook(doc, nodeId);
  if (hit) return characterGroupId(hit.character.id);
  if (findScene(doc, nodeId)) return SCENES_GROUP_ID;
  return null;
}

/** 卡片在画布上的绝对位置（分组里的 = 分组位置 + 相对位置）。 */
export function absolutePosition(doc: DramaCanvasDoc, positions: Record<string, XY>, nodeId: string): XY | null {
  const p = positions[nodeId];
  if (!p) return null;
  const gid = parentGroupOf(doc, nodeId);
  if (!gid) return p;
  const g = positions[gid];
  return g ? { x: g.x + p.x, y: g.y + p.y } : p;
}

// ── 改名 / 改文字 ────────────────────────────────────────────────────────────

export function renameCharacter(doc: DramaCanvasDoc, characterId: string, name: string): DramaCanvasDoc {
  const n = name.trim();
  const c = findCharacter(doc, characterId);
  if (!n || !c || c.name === n) return doc;
  return { ...doc, characters: doc.characters.map((x) => (x.id === characterId ? { ...x, name: n } : x)) };
}

export function renameScene(doc: DramaCanvasDoc, sceneId: string, name: string): DramaCanvasDoc {
  const n = name.trim();
  if (!n) return doc;
  return mapScene(doc, sceneId, (s) => (s.name === n ? s : { ...s, name: n }));
}

export function renameMaterial(doc: DramaCanvasDoc, materialId: string, name: string): DramaCanvasDoc {
  const n = name.trim();
  if (!n) return doc;
  return mapMaterial(doc, materialId, (m) => (m.name === n ? m : { ...m, name: n }));
}

export function setMaterialText(doc: DramaCanvasDoc, materialId: string, text: string): DramaCanvasDoc {
  return mapMaterial(doc, materialId, (m) => (m.kind !== "text" || m.text === text ? m : { ...m, text }));
}

/** 上传的图当素材图时的名字：去掉扩展名，最长 20 字。 */
export function nameFromFile(fileName: string): string {
  return fileName.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim().slice(0, 20);
}

// ── 删除（先确认，写清会删掉什么）────────────────────────────────────────────

export interface DeletePlan {
  title: string;
  body: string;
  /** 会从画布上消失的节点 id（选中 / 详情弹窗指着它们时要收起）。 */
  ids: string[];
  apply: (doc: DramaCanvasDoc) => DramaCanvasDoc;
}

/** 有几个片段用到了这些东西（片段文本里的 @ 引用）。 */
export function segmentsUsing(doc: DramaCanvasDoc, ids: ReadonlySet<string>): number {
  let n = 0;
  for (const ep of doc.episodes) {
    for (const s of ep.segments) {
      if (parseRefs(s.text).some((r) => ids.has(r.id))) n++;
    }
  }
  return n;
}

const edgesTouching = (doc: DramaCanvasDoc, ids: ReadonlySet<string>) =>
  doc.board.edges.filter((e) => ids.has(e.source) || ids.has(e.target)).length;

function refsLine(n: number): string {
  return n ? `有 ${n} 个片段用到了它，删掉后那些片段里的引用就对不上了。` : "";
}

/** 删某个节点前要问的话，和真正删的那一步。不能删的（场景分组）返回 null。 */
export function deletePlan(doc: DramaCanvasDoc, nodeId: string): DeletePlan | null {
  const cid = characterIdOfGroup(nodeId);
  if (cid) {
    const c = findCharacter(doc, cid);
    if (!c) return null;
    const ids = c.looks.map((l) => l.id);
    const photos = c.looks.reduce((n, l) => n + l.images.versions.length, 0);
    const lines = [
      photos
        ? `它的 ${c.looks.length} 个造型、${photos} 张定妆照都会一起删掉，已花的积分不退。`
        : `它的 ${c.looks.length} 个造型都会一起删掉。`,
      refsLine(segmentsUsing(doc, new Set(ids))),
    ];
    return {
      title: `删除角色「${c.name}」？`,
      body: lines.filter(Boolean).join(""),
      ids: [nodeId, ...ids],
      apply: (d) => removeCharacter(d, cid),
    };
  }

  const hit = findLook(doc, nodeId);
  if (hit) {
    const { character, look } = hit;
    const photos = look.images.versions.length;
    const last = character.looks.length <= 1;
    const lines = [
      photos ? `这个造型的 ${photos} 张定妆照也会一起删掉，已花的积分不退。` : "",
      last ? `这是${character.name}唯一的造型，${character.name}这个角色也会一起删掉。` : "",
      refsLine(segmentsUsing(doc, new Set([nodeId]))),
    ];
    return {
      title: `删除造型「${character.name}·${look.name}」？`,
      body: lines.filter(Boolean).join("") || "删掉后不能恢复。",
      ids: last ? [characterGroupId(character.id), nodeId] : [nodeId],
      apply: (d) => removeLook(d, nodeId),
    };
  }

  const scene = findScene(doc, nodeId);
  if (scene) {
    const photos = scene.images.versions.length;
    const lines = [
      photos ? `这个场景的 ${photos} 张场景图也会一起删掉，已花的积分不退。` : "",
      refsLine(segmentsUsing(doc, new Set([nodeId]))),
    ];
    return {
      title: `删除场景「${scene.name}」？`,
      body: lines.filter(Boolean).join("") || "删掉后不能恢复。",
      ids: [nodeId],
      apply: (d) => removeScene(d, nodeId),
    };
  }

  const m = findMaterial(doc, nodeId);
  if (m) {
    const lines = m.kind === "image" ? [m.images?.versions.some((v) => v.runId) ? "生成这张图花的积分不退。" : ""] : [];
    const links = edgesTouching(doc, new Set([nodeId]));
    if (links) lines.push(`连着它的 ${links} 条线也会一起删掉。`);
    lines.push(refsLine(segmentsUsing(doc, new Set([nodeId]))));
    return {
      title: m.kind === "image" ? `删除素材图「${m.name}」？` : `删除文字「${m.name}」？`,
      body: lines.filter(Boolean).join("") || "删掉后不能恢复。",
      ids: [nodeId],
      apply: (d) => removeMaterial(d, nodeId),
    };
  }
  return null;
}

// ── 视口 ─────────────────────────────────────────────────────────────────────

export type BoardViewport = DramaCanvasDoc["board"]["viewport"];

/**
 * 文档里的视口还是初始值 = 没有可用的老值。视口现在只记在本机（viewport-store.ts），
 * doc.board.viewport 不再维护，只在本机没记录时读一次老值。
 */
export function isInitialViewport(v: BoardViewport): boolean {
  return v.x === 0 && v.y === 0 && v.zoom === 1;
}
