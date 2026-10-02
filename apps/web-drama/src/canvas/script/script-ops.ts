// ─────────────────────────────────────────────────────────────────────────────
// canvas/script/script-ops.ts —— 剧本页专用的文档编辑（v0.198，docs/drama-canvas-plan.md §2.3）。
//
// 全部是纯函数：(doc, ...) => doc，不改入参，没变化时原样返回入参（update() 靠 === 判断要不要存）。
// 合并 AI 结果不在这里（那是 core/merge.ts 的事）；这里只放「用户在剧本页上点了什么」。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CanvasOutlineEpisode,
  CanvasScript,
  CanvasScriptEpisode,
  CanvasScriptVersion,
  DramaCanvasDoc,
} from "@ai-star-eco/types/drama-canvas";
import { isTerminalStatus, pushScriptHistory } from "@/canvas/core";

/** 超过这么多字的一集，界面上提示「这一集很长」。 */
export const LONG_EPISODE_CHARS = 30_000;
/** 重写要求最多几个字（与服务端 DRAMA_CANVAS_INSTRUCTION_TOO_LONG 同一个上限）。 */
export const INSTRUCTION_MAX_CHARS = 200;

export const isBlank = (s: string | undefined | null) => !s || !s.trim();

/** 按字数算（emoji / 生僻字算一个字，与服务端 codePoint 计数一致）。 */
export function charCount(text: string | undefined | null): number {
  if (!text) return 0;
  let n = 0;
  for (const _ of text) n++;
  return n;
}

const placeholderTitle = (no: number) => `第 ${no} 集`;

function withScript(doc: DramaCanvasDoc, fn: (s: CanvasScript) => CanvasScript): DramaCanvasDoc {
  const script = fn(doc.script);
  return script === doc.script ? doc : { ...doc, script };
}

const byNo = (a: { no: number }, b: { no: number }) => a.no - b.no;

// ── 页面标题 ─────────────────────────────────────────────────────────────────

/** 「共 N 集」；一集都还没有时「还没有分集剧本」。 */
export function scriptHeading(doc: DramaCanvasDoc): string {
  const n = doc.script.episodes.length;
  return n > 0 ? `共 ${n} 集` : "还没有分集剧本";
}

/** 有没有任何一集写了正文（决定能不能「拆出角色和场景」）。 */
export function hasScriptText(doc: DramaCanvasDoc): boolean {
  return doc.script.episodes.some((e) => !isBlank(e.text));
}

// ── 故事大纲 ─────────────────────────────────────────────────────────────────

export function setSettingText(doc: DramaCanvasDoc, text: string): DramaCanvasDoc {
  return withScript(doc, (s) => {
    if ((s.setting?.text ?? "") === text && s.setting) return s;
    return { ...s, setting: { ...(s.setting ?? {}), text } };
  });
}

/** 通过故事大纲：先存一版修改记录，再写 approvedAt。没有正文、或已经通过了 → 原样返回。 */
export function approveSetting(doc: DramaCanvasDoc, at: string = new Date().toISOString()): DramaCanvasDoc {
  const setting = doc.script.setting;
  if (!setting || isBlank(setting.text) || setting.approvedAt) return doc;
  const saved = pushScriptHistory(doc, "通过故事大纲", at);
  return withScript(saved, (s) => ({ ...s, setting: { ...s.setting!, approvedAt: at } }));
}

// ── 分集剧情 ─────────────────────────────────────────────────────────────────

export type OutlinePatch = Partial<Pick<CanvasOutlineEpisode, "title" | "hook" | "summary">>;

export function patchOutlineEpisode(doc: DramaCanvasDoc, no: number, patch: OutlinePatch): DramaCanvasDoc {
  return withScript(doc, (s) => {
    const outline = s.outline;
    if (!outline) return s;
    const i = outline.episodes.findIndex((e) => e.no === no);
    if (i < 0) return s;
    const cur = outline.episodes[i];
    const next = { ...cur, ...patch };
    if (next.title === cur.title && next.hook === cur.hook && next.summary === cur.summary) return s;
    const episodes = outline.episodes.slice();
    episodes[i] = next;
    return { ...s, outline: { ...outline, episodes } };
  });
}

/**
 * 把分集剧情里的每一集补进分集剧本（按集号）：
 *   · 分集剧本里还没有这一集 → 加一条（标题取分集剧情的，正文空着）；
 *   · 已经有了、但还没有正文 → 标题跟分集剧情走；
 *   · 已经有正文 → 正文和标题都保留（标题是空的 / 还是「第 N 集」占位时才补上）。
 * 分集剧本里有、分集剧情里没有的集保留不动（那是用户的内容）。结果按集号排序。
 */
export function fillEpisodesFromOutline(doc: DramaCanvasDoc): DramaCanvasDoc {
  const planned = doc.script.outline?.episodes ?? [];
  if (!planned.length) return doc;
  const index = new Map<number, number>();
  const episodes: CanvasScriptEpisode[] = doc.script.episodes.slice();
  episodes.forEach((e, i) => index.set(e.no, i));
  let changed = false;
  for (const o of planned) {
    if (!Number.isInteger(o.no) || o.no < 1) continue;
    const title = o.title?.trim() ?? "";
    const i = index.get(o.no);
    if (i === undefined) {
      index.set(o.no, episodes.length);
      episodes.push({ no: o.no, title: title || placeholderTitle(o.no), text: "" });
      changed = true;
      continue;
    }
    const cur = episodes[i];
    if (!title || cur.title === title) continue;
    const untitled = isBlank(cur.title) || cur.title.trim() === placeholderTitle(cur.no);
    if (isBlank(cur.text) || untitled) {
      episodes[i] = { ...cur, title };
      changed = true;
    }
  }
  if (!changed) return doc;
  episodes.sort(byNo);
  return { ...doc, script: { ...doc.script, episodes } };
}

/** 通过分集剧情：先存一版修改记录，再写 approvedAt，再把各集补进分集剧本。 */
export function approveOutline(doc: DramaCanvasDoc, at: string = new Date().toISOString()): DramaCanvasDoc {
  const outline = doc.script.outline;
  if (!outline || !outline.episodes.length || outline.approvedAt) return doc;
  const saved = pushScriptHistory(doc, "通过分集剧情", at);
  const approved = withScript(saved, (s) => ({ ...s, outline: { ...s.outline!, approvedAt: at } }));
  return fillEpisodesFromOutline(approved);
}

// ── 分集剧本 ─────────────────────────────────────────────────────────────────

export function patchScriptEpisode(
  doc: DramaCanvasDoc,
  no: number,
  patch: Partial<Pick<CanvasScriptEpisode, "title" | "text" | "locked">>,
): DramaCanvasDoc {
  return withScript(doc, (s) => {
    const i = s.episodes.findIndex((e) => e.no === no);
    if (i < 0) return s;
    const cur = s.episodes[i];
    const next: CanvasScriptEpisode = { ...cur, ...patch };
    if (patch.locked === false) delete next.locked; // 不锁就不写这个字段（与服务端存的形状一致）
    if (next.title === cur.title && next.text === cur.text && !!next.locked === !!cur.locked) return s;
    const episodes = s.episodes.slice();
    episodes[i] = next;
    return { ...s, episodes };
  });
}

export function setEpisodeLocked(doc: DramaCanvasDoc, no: number, locked: boolean): DramaCanvasDoc {
  return patchScriptEpisode(doc, no, { locked });
}

/** 某个运行引用还在跑。 */
const inFlight = (e: CanvasScriptEpisode) => !!e.run && !isTerminalStatus(e.run.status);

/**
 * 「写全部分集剧本」要写哪几集：还没有正文、没锁上、也不在写的集（含分集剧情里有、分集剧本里还没有的集）。升序。
 */
export function episodesToWrite(doc: DramaCanvasDoc): number[] {
  const s = doc.script;
  const known = new Set(s.episodes.map((e) => e.no));
  const out = s.episodes.filter((e) => isBlank(e.text) && !e.locked && !inFlight(e)).map((e) => e.no);
  for (const o of s.outline?.episodes ?? []) {
    if (Number.isInteger(o.no) && o.no > 0 && !known.has(o.no)) out.push(o.no);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * 用过的最大集号：分集剧本、逐集制作（片段 / 成片按集号存）、造型和场景的「出现在第几集」。
 * 删掉的集在制作数据里可能还留着（Codex 评审 #6），新加的集不能复用这个号，否则会接上旧片段、旧成片。
 */
export function maxUsedEpisodeNo(doc: DramaCanvasDoc): number {
  let m = 0;
  for (const e of doc.script.episodes) m = Math.max(m, e.no);
  for (const e of doc.episodes) m = Math.max(m, e.no);
  for (const c of doc.characters) for (const l of c.looks) for (const n of l.episodes) m = Math.max(m, n);
  for (const sc of doc.scenes) for (const n of sc.episodes) m = Math.max(m, n);
  return m;
}

/** 这一集在逐集制作里已经有什么（删剧本前要说清会丢什么）。 */
export function episodeProduction(doc: DramaCanvasDoc, no: number): { segments: number; assembled: boolean } {
  const ep = doc.episodes.find((e) => e.no === no);
  return { segments: ep?.segments.length ?? 0, assembled: !!ep?.assembled };
}

/** 加一集（粘贴来的剧本用）：接在用过的最大集号后面（见 maxUsedEpisodeNo），标题「第 N 集」，正文空着。 */
export function addScriptEpisode(doc: DramaCanvasDoc): { doc: DramaCanvasDoc; no: number } {
  const no = maxUsedEpisodeNo(doc) + 1;
  const episodes = [...doc.script.episodes, { no, title: placeholderTitle(no), text: "" }];
  return { doc: { ...doc, script: { ...doc.script, episodes } }, no };
}

/**
 * 删掉一集后，后面的集要不要往前补号。集号被这些东西引用着，只有都还没有的时候才补：
 * 拆过角色和场景（造型 / 场景记着出现在第几集）、逐集制作里已经有东西、有分集剧情（按集号对应）、
 * 某一集正在写（运行记录按集号合回来）。
 */
export function canRenumberEpisodes(doc: DramaCanvasDoc): boolean {
  const s = doc.script;
  return !s.extractedAt && doc.episodes.length === 0 && !(s.outline?.episodes.length ?? 0) && !s.episodes.some(inFlight);
}

/** 删这一集。能补号时（见 canRenumberEpisodes）后面的集往前补成连续的，补过号的集清掉旧的运行引用。 */
export function removeScriptEpisode(doc: DramaCanvasDoc, no: number): DramaCanvasDoc {
  const rest = doc.script.episodes.filter((e) => e.no !== no);
  if (rest.length === doc.script.episodes.length) return doc;
  if (!canRenumberEpisodes(doc)) return { ...doc, script: { ...doc.script, episodes: rest } };
  const episodes = rest
    .slice()
    .sort(byNo)
    .map((e, i) => {
      if (e.no === i + 1) return e;
      // 运行引用是按集号记的（script:episode:<no>），换了号还留着就会对到别的集上
      const { run: _run, ...moved } = e;
      return { ...moved, no: i + 1 };
    });
  return { ...doc, script: { ...doc.script, episodes } };
}

/** 「第 3–6 集」「第 1、3、4 集」「12 集」（连续的写成一段；不连续且太多时只说几集）。 */
export function formatEpisodeList(nos: number[]): string {
  const list = [...new Set(nos)].sort((a, b) => a - b);
  if (!list.length) return "";
  if (list.length === 1) return `第 ${list[0]} 集`;
  const contiguous = list.every((n, i) => i === 0 || n === list[i - 1] + 1);
  if (contiguous) return `第 ${list[0]}–${list[list.length - 1]} 集`;
  if (list.length <= 8) return `第 ${list.join("、")} 集`;
  return `${list.length} 集`;
}

// ── 修改记录 ─────────────────────────────────────────────────────────────────

/** 一版修改记录里有什么（「故事大纲 · 分集剧情 2 集 · 分集剧本 2 集」）。 */
export function versionSummary(v: CanvasScriptVersion): string {
  const parts: string[] = [];
  if (!isBlank(v.setting)) parts.push("故事大纲");
  if (v.outline?.length) parts.push(`分集剧情 ${v.outline.length} 集`);
  const written = v.episodes.filter((e) => !isBlank(e.text)).length;
  parts.push(written ? `分集剧本 ${written} 集` : "还没有分集剧本");
  return parts.join(" · ");
}
