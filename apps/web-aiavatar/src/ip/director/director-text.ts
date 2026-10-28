// ─────────────────────────────────────────────────────────────────────────────
// 导演台的文字小工具：原文定位、前后对比、片段在本集正文里的位置。
// locate 与服务端 DirectorAssistant.locate 同一规则（先逐字、再忽略空白差异、多处取第一处），
// 预览里看到的位置就是采用时替换的位置。
// ─────────────────────────────────────────────────────────────────────────────

import type { DirectorClip, DirectorShot } from "@ai-star-eco/types";

export function locate(content: string, original: string): [number, number] | null {
  if (!content || !original) return null;
  const at = content.indexOf(original);
  if (at >= 0) return [at, at + original.length];
  const map: number[] = [];
  let norm = "";
  for (let i = 0; i < content.length; i++) {
    if (/\s/.test(content[i])) continue;
    norm += content[i];
    map.push(i);
  }
  const needle = original.replace(/\s+/g, "");
  if (!needle) return null;
  const k = norm.indexOf(needle);
  if (k < 0) return null;
  return [map[k], map[k + needle.length - 1] + 1];
}

/** 所有逐字出现的位置。 */
export function locateAll(content: string, text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!text) return out;
  for (let at = content.indexOf(text); at >= 0; at = content.indexOf(text, at + 1)) out.push([at, at + text.length]);
  return out;
}

export type DiffPart = { kind: "same" | "del" | "add"; text: string };

/** 前后对比：短文按字、长文按行（中文没有空格分词，按字最直观）。 */
export function diffText(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ kind: "same", text: before }] : [];
  const long = before.length + after.length > 3000;
  const a = long ? before.split(/(?<=\n)/) : [...before];
  const b = long ? after.split(/(?<=\n)/) : [...after];
  if (a.length * b.length > 4_000_000) return [{ kind: "del", text: before }, { kind: "add", text: after }];
  const dp: Uint16Array[] = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text; else out.push({ kind, text });
  };
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push("same", a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push("del", a[i]); i++; }
    else { push("add", b[j]); j++; }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return out;
}

type ShotLike = Pick<DirectorShot, "durationSec" | "size" | "camera" | "action" | "still" | "dialogue"> & { id?: string | null };

export type ShotChange =
  | { kind: "same"; no: number; shot: ShotLike }
  | { kind: "changed"; no: number; shot: ShotLike; before: ShotLike; fields: string[] }
  | { kind: "added"; no: number; shot: ShotLike }
  | { kind: "removed"; before: ShotLike; beforeNo: number };

const FIELD_LABEL: Record<string, string> = { durationSec: "时长", size: "景别", camera: "机位", action: "动作", still: "分镜画面", dialogue: "台词" };

/** 镜头前后对比：按原镜头 id 对上，没 id 的是新加的，原来有、现在没有的是删掉的。 */
export function shotChanges(before: ShotLike[], after: ShotLike[]): ShotChange[] {
  const byId = new Map(before.filter(s => s.id).map((s, i) => [s.id!, { s, i }]));
  const used = new Set<string>();
  const out: ShotChange[] = after.map((s, i) => {
    const old = s.id ? byId.get(s.id) : undefined;
    if (!old) return { kind: "added", no: i + 1, shot: s };
    used.add(s.id!);
    const fields = (Object.keys(FIELD_LABEL) as Array<keyof ShotLike>).filter(f =>
      f === "dialogue" ? JSON.stringify((s.dialogue ?? []).map(l => [l.speakerId ?? null, l.text])) !== JSON.stringify((old.s.dialogue ?? []).map(l => [l.speakerId ?? null, l.text]))
        : String(s[f] ?? "") !== String(old.s[f] ?? ""));
    return fields.length ? { kind: "changed", no: i + 1, shot: s, before: old.s, fields: fields.map(f => FIELD_LABEL[f as string]) } : { kind: "same", no: i + 1, shot: s };
  });
  before.forEach((s, i) => { if (s.id && !used.has(s.id)) out.push({ kind: "removed", before: s, beforeNo: i + 1 }); });
  return out;
}

export type ClipRange = { start: number; end: number; how: "quote" | "dialogue" };

/**
 * 每个片段在本集正文里的位置（段落级）。只用真实依据：
 * quote = 写分镜脚本时记下的起始句在正文里找到了，到下一个找到起始句的片段为止；
 * dialogue = 没有起始句（旧片段、拆出来的片段）时按台词在正文里逐字找到的段落。都找不到就没有位置，不猜。
 */
export function clipRanges(content: string, clips: Pick<DirectorClip, "id" | "order" | "sourceQuote" | "shots">[]): Map<string, ClipRange> {
  const out = new Map<string, ClipRange>();
  const sorted = [...clips].sort((a, b) => a.order - b.order);
  const starts: Array<{ id: string; at: number }> = [];
  let from = 0;
  for (const c of sorted) {
    if (!c.sourceQuote) continue;
    const r = locate(content.slice(from), c.sourceQuote);
    if (!r) continue;
    starts.push({ id: c.id, at: from + r[0] });
    from += r[0];
  }
  starts.forEach((s, i) => out.set(s.id, { start: s.at, end: i + 1 < starts.length ? starts[i + 1].at : content.length, how: "quote" }));
  for (const c of sorted) {
    if (out.has(c.id)) continue;
    const hits = c.shots.flatMap(s => s.dialogue).map(l => l.text.trim()).filter(t => t.length >= 4)
      .map(t => locate(content, t)).filter((r): r is [number, number] => !!r);
    if (!hits.length) continue;
    const lo = Math.min(...hits.map(h => h[0])), hi = Math.max(...hits.map(h => h[1]));
    const start = content.lastIndexOf("\n", lo - 1) + 1;
    const nl = content.indexOf("\n", hi);
    out.set(c.id, { start, end: nl < 0 ? content.length : nl, how: "dialogue" });
  }
  return out;
}

/** 正文按行切成段落，带起止位置，方便按片段位置高亮。 */
export function paragraphsWithOffsets(content: string): Array<{ text: string; start: number; end: number }> {
  const out: Array<{ text: string; start: number; end: number }> = [];
  let at = 0;
  for (const line of content.split("\n")) {
    if (line.trim()) out.push({ text: line, start: at, end: at + line.length });
    at += line.length + 1;
  }
  return out;
}

/** 没有回复时正文快照的旧建议：只认「前文 + 文字 + 后文」整体还在的那一处，与服务端 DirectorAssistant.findAnchor 一致。 */
export function findAnchor(content: string, text: string, before: string, after: string, hint: number): [number, number] | null {
  const full = before + text + after;
  if (!full) return null;
  let best = -1;
  for (let at = content.indexOf(full); at >= 0; at = content.indexOf(full, at + 1))
    if (best < 0 || Math.abs(at + before.length - hint) < Math.abs(best + before.length - hint)) best = at;
  return best < 0 ? null : [best + before.length, best + before.length + text.length];
}

/**
 * 把快照 base 里的 [start, end) 映射到用户改过之后的 current 里，与服务端 DirectorAssistant.mapRange 同一规则：
 * 这段所在的行原样还在才映射；这几行改过、删掉，或是几行一模一样的文字而数目变了，返回 null。
 */
export function mapRange(base: string, current: string, start: number, end: number): [number, number] | null {
  if (start < 0 || end < start || end > base.length) return null;
  if (base === current) return [start, end];
  const a = base.split("\n"), b = current.split("\n");
  const as = lineStarts(a), bs = lineStarts(b);
  const ls = lineOf(as, start), le = end > start ? lineOf(as, end - 1) : ls;
  const match = matchLines(a, b);
  for (let i = ls; i <= le; i++) {
    if (match[i] < 0 || (i > ls && match[i] !== match[i - 1] + 1)) return null;
    const ca = a.filter(x => x === a[i]).length, cb = b.filter(x => x === a[i]).length;
    if (ca > 1 && ca !== cb) return null;
  }
  const ns = bs[match[ls]] + (start - as[ls]), ne = bs[match[le]] + (end - as[le]);
  if (ne < ns || ne > current.length || current.slice(ns, ne) !== base.slice(start, end)) return null;
  return [ns, ne];
}

function lineStarts(lines: string[]) {
  const out = [0];
  for (let i = 1; i < lines.length; i++) out.push(out[i - 1] + lines[i - 1].length + 1);
  return out;
}

function lineOf(starts: number[], offset: number) {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= offset) i++;
  return i;
}

function matchLines(a: string[], b: string[]): number[] {
  const n = a.length, m = b.length;
  const match = new Array<number>(n).fill(-1);
  if (n * m > 4_000_000) {
    let p = 0;
    while (p < n && p < m && a[p] === b[p]) { match[p] = p; p++; }
    for (let s = 1; s <= Math.min(n, m) - p && a[n - s] === b[m - s]; s++) match[n - s] = m - s;
    return match;
  }
  const dp: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j] && dp[i][j] === dp[i + 1][j + 1] + 1) match[i++] = j++;
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return match;
}

/** 剧本建议在正文里的位置：有锚点按锚点；没有锚点的旧建议要求原文唯一出现。 */
export function proposalRange(content: string, p: { original?: string; base?: string | null; anchor?: { start: number; end: number; text: string; before: string; after: string } | null }): [number, number] | null {
  if (p.anchor && p.base != null) return mapRange(p.base, content, p.anchor.start, p.anchor.end);
  if (p.anchor) return findAnchor(content, p.anchor.text, p.anchor.before, p.anchor.after, p.anchor.start);
  const first = locate(content, p.original ?? "");
  if (!first) return null;
  return locate(content.slice(first[1]), p.original ?? "") ? null : first;
}
