// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets/references.ts —— 出图面板里「连进来的参考」与「上传参考」（v0.198）。
//
// 连线的规则（能连什么、不许重复）只有 board/connect.ts 一份（§8.0.1 ④），这里只调它：
//   上传参考 = 建一张素材图（images 里放上传的那张）+ 连一条 素材图 → 目标 的线。
// ─────────────────────────────────────────────────────────────────────────────

import type { CanvasAsset, DramaCanvasDoc } from "@ai-star-eco/types/drama-canvas";
import { addBoardEdge, removeBoardEdge } from "@/canvas/board/connect";
import { addMaterial, findLook, findMaterial, findScene, lookLabel, mapMaterial, pickedImage } from "@/canvas/core";

export interface ReferenceItem {
  edgeId: string;
  sourceId: string;
  kind: "look" | "scene" | "image" | "text";
  label: string;
  /** 图（造型 / 场景 / 素材图挑中的那张）；还没有图时缺省。 */
  asset?: CanvasAsset;
  /** 文字素材的正文。 */
  text?: string;
}

/** 连到 targetId 上的参考（按连线顺序）；源头已经不在的线跳过。 */
export function referencesOf(doc: DramaCanvasDoc, targetId: string): ReferenceItem[] {
  const out: ReferenceItem[] = [];
  for (const e of doc.board.edges) {
    if (e.target !== targetId) continue;
    const look = findLook(doc, e.source);
    if (look) {
      out.push({ edgeId: e.id, sourceId: e.source, kind: "look", label: lookLabel(look.character, look.look), asset: pickedImage(look.look.images) });
      continue;
    }
    const scene = findScene(doc, e.source);
    if (scene) {
      out.push({ edgeId: e.id, sourceId: e.source, kind: "scene", label: scene.name, asset: pickedImage(scene.images) });
      continue;
    }
    const m = findMaterial(doc, e.source);
    if (m) {
      out.push(
        m.kind === "image"
          ? { edgeId: e.id, sourceId: e.source, kind: "image", label: m.name, asset: pickedImage(m.images) }
          : { edgeId: e.id, sourceId: e.source, kind: "text", label: m.name, text: m.text ?? "" },
      );
    }
  }
  return out;
}

/** 断开一条参考连线。 */
export function disconnectReference(doc: DramaCanvasDoc, edgeId: string): DramaCanvasDoc {
  return removeBoardEdge(doc, edgeId);
}

/**
 * 上传的一张图变成目标的参考：新建一张素材图（放这张图）并连过去。返回新文档和新素材 id。
 * 连不上（目标不在了 / 不能当目标）时仍保留这张素材图，materialId 照样返回（图已经传上去了，别让它丢）。
 */
export function addUploadedReference(
  doc: DramaCanvasDoc,
  targetId: string,
  asset: CanvasAsset,
  name?: string,
): { doc: DramaCanvasDoc; materialId: string } {
  const added = addMaterial(doc, "image");
  const materialId = added.id;
  let next = mapMaterial(added.doc, materialId, (m) => ({
    ...m,
    ...(name?.trim() ? { name: name.trim() } : {}),
    images: { versions: [{ key: asset.key, ...(asset.url ? { url: asset.url } : {}) }] },
  }));
  next = addBoardEdge(next, materialId, targetId);
  return { doc: next, materialId };
}

/** 上传文件名 → 素材图名（去掉扩展名，太长截断）；没有像样的名字返回 undefined（用 addMaterial 的缺省名）。 */
export function materialNameFromFile(fileName: string | undefined): string | undefined {
  const base = (fileName ?? "").replace(/\.[A-Za-z0-9]{1,5}$/, "").trim();
  if (!base || /^(image|img|tmp|IMG)[-_\d]*$/i.test(base) || /^[0-9a-f-]{16,}$/i.test(base)) return undefined;
  const chars = Array.from(base);
  return chars.length > 20 ? `${chars.slice(0, 20).join("")}…` : base;
}
