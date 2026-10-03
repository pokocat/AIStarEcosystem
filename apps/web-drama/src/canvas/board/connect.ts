// ─────────────────────────────────────────────────────────────────────────────
// canvas/board/connect.ts —— 画布上的连线规则（v0.198，纯函数，有单测）。
//
// 连线 = 「拿它当参考」：source 的产物给 target 出图时当参考。允许的组合只有 CanvasBoard.edges 注释里那几种：
//   素材图 / 造型 / 场景 → 造型 / 场景 / 素材图（拿 source 挑中的那张图当参考图）
//   文字素材           → 造型 / 场景 / 素材图（把文字拼进 target 出图的提示词）
// 不许连自己、不许重复、不许连到分组、文字素材不能当 target。服务端出图时也只认这些组合。
// 拖线时每经过一张卡片都会问一次 checkConnection，所以它不能慢：只做几次查找。
// ─────────────────────────────────────────────────────────────────────────────

import type { DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { SCENES_GROUP_ID, findLook, findMaterial, findScene, newId } from "@/canvas/core";

export type BoardNodeKind = "charGroup" | "sceneGroup" | "look" | "scene" | "imageMaterial" | "textMaterial";

const CHAR_GROUP_PREFIX = "group:char:";

/** 画布上某个节点 id 是什么（认不得返回 null）。 */
export function nodeKindOf(doc: DramaCanvasDoc, id: string): BoardNodeKind | null {
  if (id === SCENES_GROUP_ID) return "sceneGroup";
  if (id.startsWith(CHAR_GROUP_PREFIX)) {
    const cid = id.slice(CHAR_GROUP_PREFIX.length);
    return doc.characters.some((c) => c.id === cid) ? "charGroup" : null;
  }
  if (findLook(doc, id)) return "look";
  if (findScene(doc, id)) return "scene";
  const m = findMaterial(doc, id);
  if (m) return m.kind === "image" ? "imageMaterial" : "textMaterial";
  return null;
}

/** 角色分组 id → 角色 id（不是角色分组返回 null）。 */
export function characterIdOfGroup(id: string): string | null {
  return id.startsWith(CHAR_GROUP_PREFIX) ? id.slice(CHAR_GROUP_PREFIX.length) : null;
}

export type ConnectRejection = "self" | "duplicate" | "group" | "text-target" | "unknown";

export type ConnectCheck = { ok: true } | { ok: false; reason: ConnectRejection };

const SOURCES: ReadonlySet<BoardNodeKind> = new Set(["look", "scene", "imageMaterial", "textMaterial"]);
const TARGETS: ReadonlySet<BoardNodeKind> = new Set(["look", "scene", "imageMaterial"]);

/** source → target 这条线能不能连。 */
export function checkConnection(doc: DramaCanvasDoc, source: string | null | undefined, target: string | null | undefined): ConnectCheck {
  if (!source || !target) return { ok: false, reason: "unknown" };
  if (source === target) return { ok: false, reason: "self" };
  const sk = nodeKindOf(doc, source);
  const tk = nodeKindOf(doc, target);
  if (!sk || !tk) return { ok: false, reason: "unknown" };
  if (sk === "charGroup" || sk === "sceneGroup" || tk === "charGroup" || tk === "sceneGroup") return { ok: false, reason: "group" };
  if (tk === "textMaterial") return { ok: false, reason: "text-target" };
  if (!SOURCES.has(sk) || !TARGETS.has(tk)) return { ok: false, reason: "unknown" };
  if (doc.board.edges.some((e) => e.source === source && e.target === target)) return { ok: false, reason: "duplicate" };
  return { ok: true };
}

/** 连不上时给用户看的一句话（跟在「这里连不上：」后面）。 */
export function rejectionText(reason: ConnectRejection): string {
  switch (reason) {
    case "self":
      return "不能连到自己";
    case "duplicate":
      return "这两张已经连过了";
    case "group":
      return "要连到分组里的卡片上";
    case "text-target":
      return "文字只能连出去给别的卡片当参考";
    default:
      return "这张卡片不能当参考";
  }
}

/** 加一条线（连不上时原样返回文档）。id 缺省新生成。 */
export function addBoardEdge(doc: DramaCanvasDoc, source: string, target: string, id: string = newId("edge")): DramaCanvasDoc {
  if (!checkConnection(doc, source, target).ok) return doc;
  return { ...doc, board: { ...doc.board, edges: [...doc.board.edges, { id, source, target }] } };
}

/** 删一条线（没有这条时原样返回）。 */
export function removeBoardEdge(doc: DramaCanvasDoc, edgeId: string): DramaCanvasDoc {
  if (!doc.board.edges.some((e) => e.id === edgeId)) return doc;
  return { ...doc, board: { ...doc.board, edges: doc.board.edges.filter((e) => e.id !== edgeId) } };
}
