// ─────────────────────────────────────────────────────────────────────────────
// canvas/core/refs.ts —— 片段文本里的 @ 引用与镜头时长（v0.198，契约见 contract.ts「纯函数」一节）。
//
// 片段文本（分镜脚本）逐镜一行，行首写时长：
//   （4 秒）日，旧教室。近景，平视。@[林微·成年](look:lk_ab12) 蹲在地上整理旧物……
//   （3 秒）特写，@[林微·成年](look:lk_ab12) 拉开书桌抽屉。
// 引用标记与服务端同一个正则（drama-canvas.ts CanvasSegment 注释）。显示名只给人看；
// id 在文档里找不到（造型被删了）时服务端当普通文字，前端把这种标签标红（由界面判断，这里只解析）。
// ─────────────────────────────────────────────────────────────────────────────

import type { SegmentRef, SegmentShot } from "./contract";
import { isValidId } from "./ids";

/** 与服务端同一个正则（全局匹配；每次用前 new 一个，避免 lastIndex 串味）。 */
export const REF_PATTERN = /@\[([^\]\n]{1,40})\]\((look|scene|material):([A-Za-z0-9_-]{1,64})\)/g;

const refRe = () => new RegExp(REF_PATTERN.source, "g");

export function parseRefs(text: string): SegmentRef[] {
  const out: SegmentRef[] = [];
  if (!text) return out;
  const re = refRe();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      kind: m[2] as SegmentRef["kind"],
      id: m[3],
      label: m[1],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/** 显示名清洗：去掉会破坏标记的 `]` 和换行，截到 40 字；空了用「引用」。 */
export function cleanRefLabel(label: string): string {
  const s = Array.from((label ?? "").replace(/[\]\n\r]/g, " ").replace(/\s+/g, " ").trim()).slice(0, 40).join("").trim();
  return s || "引用";
}

/**
 * 拼一个引用标记。id 不合法（含引用正则不认的字符）时拼不成标记，退回成普通文字「@显示名」——
 * 和「id 在文档里找不到就当普通文字」同一个处理，不会生成一个解析不出来的半截标记。
 */
export function formatRef(kind: SegmentRef["kind"], id: string, label: string): string {
  const name = cleanRefLabel(label);
  if (!isValidId(id)) return `@${name}`;
  return `@[${name}](${kind}:${id})`;
}

/** 把标记换成显示名（预览 / 复制 / 纯文字场景用）。 */
export function stripRefs(text: string): string {
  if (!text) return "";
  return text.replace(refRe(), (_all, label: string) => label);
}

/** 行首时长：「（4 秒）」「(4秒)」「（4.5 秒）」「(4s)」。 */
const SHOT_HEAD = /^\s*[（(]\s*(\d{1,3}(?:\.\d+)?)\s*(?:秒|s|S)\s*[)）]\s*/;

/**
 * 按行拆镜头：写了时长的行起一个新镜头；没写时长的行并进上一镜（第一行就没写时长时，
 * 单独成一镜、durationSec=null）。空行跳过。镜头 text 不含行首的时长。
 */
export function parseShots(text: string): SegmentShot[] {
  const shots: SegmentShot[] = [];
  if (!text) return shots;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const m = raw.match(SHOT_HEAD);
    if (m) {
      shots.push({ durationSec: Number(m[1]), text: raw.slice(m[0].length).trim() });
      continue;
    }
    const last = shots[shots.length - 1];
    if (last) last.text = last.text ? `${last.text}\n${raw.trim()}` : raw.trim();
    else shots.push({ durationSec: null, text: raw.trim() });
  }
  return shots;
}

/** 各镜时长之和（没写的按 0），取整到秒。UI 改片段文本时用它同步 segment.durationSec。 */
export function totalDuration(text: string): number {
  const sum = parseShots(text).reduce((acc, s) => acc + (s.durationSec ?? 0), 0);
  return Math.round(sum);
}
