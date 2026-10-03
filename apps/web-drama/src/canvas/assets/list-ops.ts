// ─────────────────────────────────────────────────────────────────────────────
// canvas/assets/list-ops.ts —— 角色和场景页的纯函数（v0.198，有单测 list-ops.test.ts）：
//   · 列表过滤（出现在第几集 / 搜索）与集数选项；
//   · 批量出图挑哪些（没写描述的、正在生成的跳过，并说清跳过了谁）；
//   · 造型挪到别的角色下（doc-ops 没有这一条；删最后一个造型连角色一起删的规则与 doc-ops.removeLook 一致）。
// 不改入参；没有变化时原样返回入参。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CanvasCharacter,
  CanvasImageTarget,
  CanvasMaterial,
  CanvasScene,
  DramaCanvasDoc,
  DramaCanvasRunStatus,
} from "@ai-star-eco/types/drama-canvas";
import { findCharacter, findLook, findScene, lookLabel, removeCharacter } from "@/canvas/core";

// ── 过滤 ─────────────────────────────────────────────────────────────────────

export interface AssetFilter {
  /** 只看出现在这一集的（null = 全部集）。 */
  episode: number | null;
  /** 搜索词（名字、造型名、描述里包含就算）。 */
  query: string;
}

const norm = (s: string | undefined | null) => (s ?? "").toLowerCase();

function matches(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  return fields.some((f) => norm(f).includes(q));
}

/** 角色：任一造型出现在这一集就算；搜角色名、人物小传、造型名。 */
export function filterCharacters(characters: CanvasCharacter[], f: AssetFilter): CanvasCharacter[] {
  return characters.filter(
    (c) =>
      (f.episode == null || c.looks.some((l) => l.episodes.includes(f.episode!))) &&
      matches(f.query, c.name, c.bio, ...c.looks.map((l) => l.name)),
  );
}

/** 场景：出现在这一集；搜名字和描述。 */
export function filterScenes(scenes: CanvasScene[], f: AssetFilter): CanvasScene[] {
  return scenes.filter((s) => (f.episode == null || s.episodes.includes(f.episode)) && matches(f.query, s.name, s.prompt));
}

/** 素材不分集：只按搜索词（名字、文字、提示词）。 */
export function filterMaterials(materials: CanvasMaterial[], f: Pick<AssetFilter, "query">): CanvasMaterial[] {
  return materials.filter((m) => matches(f.query, m.name, m.text, m.prompt));
}

/** 「全部集 ▾」里的选项：剧本里的集号，加上造型 / 场景里写到、剧本里却没有的集号（升序去重）。 */
export function episodeOptions(doc: DramaCanvasDoc): number[] {
  const set = new Set<number>(doc.script.episodes.map((e) => e.no));
  for (const c of doc.characters) for (const l of c.looks) for (const n of l.episodes) set.add(n);
  for (const s of doc.scenes) for (const n of s.episodes) set.add(n);
  return [...set].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
}

/** 「出现在第 1, 2 集」；一集都没有返回 null。 */
export function episodesText(episodes: number[]): string | null {
  const list = [...new Set(episodes)].sort((a, b) => a - b);
  return list.length ? `出现在第 ${list.join(", ")} 集` : null;
}

// ── 批量出图 ─────────────────────────────────────────────────────────────────

export type BatchPick = { kind: "look"; id: string } | { kind: "scene"; id: string };

/** 服务端 image-batch 的上限：一次最多 20 项、总共 40 张；超了整批 400 DRAMA_CANVAS_BATCH_TOO_LARGE。 */
export const BATCH_MAX_ITEMS = 20;
export const BATCH_MAX_IMAGES = 40;

/**
 * 超上限时给用户看的一句话（没超返回 null）。前端不截断、不自动分批：让用户自己取消几个，
 * 花多少钱、生成哪些都由他定。
 */
export function batchLimitReason(items: { count: number }[]): string | null {
  if (items.length > BATCH_MAX_ITEMS) return `一次最多 ${BATCH_MAX_ITEMS} 个，先取消几个。`;
  const images = items.reduce((n, i) => n + i.count, 0);
  if (images > BATCH_MAX_IMAGES) return `一次最多出 ${BATCH_MAX_IMAGES} 张，先取消几个。`;
  return null;
}

export interface BatchPlan {
  /** 真正要出图的（每项一张）。 */
  items: { target: CanvasImageTarget; count: number }[];
  /** 跳过的：给用户看的名字 + 原因。 */
  skipped: { label: string; reason: "no-prompt" | "running" | "missing" }[];
}

const isPending = (s: DramaCanvasRunStatus | undefined) => s === "queued" || s === "running";

/**
 * 选中的造型 / 场景 → 批量出图的请求项。没写描述的（服务端会拒）、正在生成的跳过；已经被删掉的也跳过。
 * runStatus 给「这个目标当前的运行状态」（优先用轮询到的，缺省读文档里记着的引用）。
 */
export function planBatch(
  doc: DramaCanvasDoc,
  picks: BatchPick[],
  runStatus: (pick: BatchPick) => DramaCanvasRunStatus | undefined,
): BatchPlan {
  const items: BatchPlan["items"] = [];
  const skipped: BatchPlan["skipped"] = [];
  const seen = new Set<string>();
  for (const p of picks) {
    const k = `${p.kind}:${p.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    let label = "";
    let prompt = "";
    if (p.kind === "look") {
      const hit = findLook(doc, p.id);
      if (!hit) {
        skipped.push({ label: "已删掉的造型", reason: "missing" });
        continue;
      }
      label = lookLabel(hit.character, hit.look);
      prompt = hit.look.prompt;
    } else {
      const s = findScene(doc, p.id);
      if (!s) {
        skipped.push({ label: "已删掉的场景", reason: "missing" });
        continue;
      }
      label = s.name;
      prompt = s.prompt;
    }
    if (!prompt.trim()) skipped.push({ label, reason: "no-prompt" });
    else if (isPending(runStatus(p))) skipped.push({ label, reason: "running" });
    else items.push({ target: { kind: p.kind, id: p.id }, count: 1 });
  }
  return { items, skipped };
}

/** 跳过说明（一句话；没有跳过返回 null）。 */
export function skippedText(skipped: BatchPlan["skipped"]): string | null {
  const noPrompt = skipped.filter((s) => s.reason === "no-prompt").map((s) => `「${s.label}」`);
  const running = skipped.filter((s) => s.reason === "running").map((s) => `「${s.label}」`);
  const parts: string[] = [];
  const list = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join("")}等 ${names.length} 个` : names.join(""));
  if (noPrompt.length) parts.push(`${list(noPrompt)}还没写描述`);
  if (running.length) parts.push(`${list(running)}正在生成`);
  return parts.length ? `${parts.join("，")}，这次跳过。` : null;
}

// ── 造型挪到别的角色 ─────────────────────────────────────────────────────────

/**
 * 把造型挪到另一个角色下（接在最后）。原角色因此一个造型都不剩时，整个角色一起删掉
 * （角色至少要有一个造型，和 doc-ops.removeLook 同一条规则）。
 * 造型在画布上的位置是相对原角色分组的，挪过去之后作废，删掉让画布重新排。
 */
export function moveLook(doc: DramaCanvasDoc, lookId: string, toCharacterId: string): DramaCanvasDoc {
  const hit = findLook(doc, lookId);
  const to = findCharacter(doc, toCharacterId);
  if (!hit || !to || hit.character.id === toCharacterId) return doc;
  const fromId = hit.character.id;
  const characters = doc.characters.map((c) => {
    if (c.id === fromId) return { ...c, looks: c.looks.filter((l) => l.id !== lookId) };
    if (c.id === toCharacterId) return { ...c, looks: [...c.looks, hit.look] };
    return c;
  });
  const positions = { ...doc.board.positions };
  delete positions[lookId];
  let next: DramaCanvasDoc = { ...doc, characters, board: { ...doc.board, positions } };
  if (!next.characters.find((c) => c.id === fromId)?.looks.length) next = removeCharacter(next, fromId);
  return next;
}

/** 挪走之后原角色会不会被删掉（给确认框用）。 */
export function moveEmptiesCharacter(doc: DramaCanvasDoc, lookId: string): boolean {
  const hit = findLook(doc, lookId);
  return !!hit && hit.character.looks.length <= 1;
}

/** 集号列表里加 / 去掉一集（升序）。 */
export function toggleEpisode(episodes: number[], no: number): number[] {
  const set = new Set(episodes);
  if (set.has(no)) set.delete(no);
  else set.add(no);
  return [...set].sort((a, b) => a - b);
}
