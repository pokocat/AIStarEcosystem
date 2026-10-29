"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type RefObject } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * 一个编辑框最多放这么多字。依据（2026-10-29 本机 Chrome 实测，每行 24 字的剧本）：框里已有 6 万字时末尾每打一个字约 0.1 秒，
 * 12 万字约 0.35 秒，25 万字约 1.2 秒，100 万字 10–14 秒。正文本身不限长，超过的按段编辑：只把正在改的那一段放进编辑框。
 */
export const EDIT_MAX = 60000;
/** 每段大约多少字：编辑框里只有这么多字，打字没有延迟。 */
export const SECTION_CHARS = 15000;
const HEADING = /^\s*(#{1,6}\s|第[0-9一二三四五六七八九十百千零两]+[集场幕章回])/;

/** 按行把正文切成段：每段不超过 size 字，凑够一半以后遇到「第N集 / # 标题」就从标题处断开；没换行的超长一行按字数切。 */
export function splitSections(text: string, size = SECTION_CHARS): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let start = 0, pos = 0;
  while (pos < text.length) {
    const nl = text.indexOf("\n", pos);
    let lineEnd = nl < 0 ? text.length : nl + 1;
    if (lineEnd - pos > size) lineEnd = pos + size;
    const len = pos - start;
    if (len > 0 && (len + (lineEnd - pos) > size || (len >= size / 2 && HEADING.test(text.slice(pos, Math.min(lineEnd, pos + 40)))))) {
      out.push({ start, end: pos });
      start = pos;
    }
    pos = lineEnd;
  }
  if (start < text.length || out.length === 0) out.push({ start, end: text.length });
  return out;
}

type Active = { index: number; start: number; base: string; prefix: string; suffix: string; text: string; origLen: number };

/**
 * 长正文按段编辑：每段一行（第几段、第几到几字、开头一句），点开那一段才放进编辑框，其余不画全文，页面不卡。
 * 编辑时整份正文 = 前文 + 这一段 + 后文，原样交给 onChange（保存、草稿、冻结规则都和普通编辑框一样）。
 * 正文被别处改了（采用了助手建议、刷新回来新版本）就收起，按新正文重新分段，不拿旧前后文覆盖。
 */
export function SectionedScript({ value, onChange, label, readOnly, disabled, area, onOffset, onPaste, onTrack }: {
  value: string; onChange: (v: string) => void; label: string; readOnly?: boolean; disabled?: boolean;
  /** 正在编辑的那一段的编辑框（选区、光标位置要加上 onOffset 给的起点）。 */
  area?: RefObject<HTMLTextAreaElement | null>;
  onOffset?: (start: number) => void;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  onTrack?: () => void;
}) {
  const [active, setActive] = useState<Active | null>(null);
  const own = useRef<HTMLTextAreaElement>(null);
  const box = area ?? own;
  const stale = !!active && value !== active.prefix + active.text + active.suffix;
  useEffect(() => { if (stale) { setActive(null); onOffset?.(0); } }, [stale]); // eslint-disable-line react-hooks/exhaustive-deps
  const source = active && !stale ? active.base : value;
  const sections = useMemo(() => splitSections(source), [source]);
  useEffect(() => { if (active) box.current?.focus(); }, [active?.index]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (i: number) => {
    const s = sections[i];
    setActive({ index: i, start: s.start, base: value, prefix: value.slice(0, s.start), suffix: value.slice(s.end), text: value.slice(s.start, s.end), origLen: s.end - s.start });
    onOffset?.(s.start);
  };
  const close = () => { setActive(null); onOffset?.(0); };
  const delta = active && !stale ? active.text.length - active.origLen : 0;
  const n = (x: number) => x.toLocaleString("zh-CN");
  return <div className="director-sections" role="group" aria-label={label}>
    <p className="director-sections-head">正文共 {n(value.length)} 字，放进一个编辑框会卡，分成 {sections.length} 段显示。点一段展开编辑，改完收起。</p>
    {sections.map((s, i) => {
      const shift = active && i > active.index ? delta : 0;
      const from = s.start + shift + 1, to = (i === active?.index ? s.start + active.text.length : s.end + shift);
      if (active && !stale && i === active.index) return <div key={s.start} className="director-section is-active">
        <button type="button" className="director-section-row" aria-expanded onClick={close}>
          <ChevronDown size={14}/><b>第 {i + 1} 段</b><small>第 {n(from)}–{n(to)} 字</small><span>收起</span></button>
        <textarea ref={box} className="director-script-text" aria-label={`${label}（第 ${i + 1} 段）`} value={active.text} disabled={disabled} readOnly={readOnly}
          onChange={e => { if (readOnly) return; const text = e.target.value; setActive(a => a && { ...a, text }); onChange(active.prefix + text + active.suffix); onTrack?.(); }}
          onPaste={onPaste} onSelect={onTrack} onKeyUp={onTrack} onMouseUp={onTrack}/>
      </div>;
      const head = source.slice(s.start, Math.min(s.end, s.start + 80)).split("\n").find(l => l.trim()) ?? "";
      return <button key={s.start} type="button" className="director-section director-section-row" aria-expanded={false} disabled={disabled} onClick={() => open(i)}>
        <ChevronRight size={14}/><b>第 {i + 1} 段</b><small>第 {n(from)}–{n(to)} 字</small><span title={head}>{head}</span></button>;
    })}
  </div>;
}

/** 新建作品、粘贴剧本这些地方放不下长正文时的摘要：字数和开头一段；创建后在工作台按段编辑。 */
export function LongTextCard({ text, onClear, what = "创建后在工作台按段编辑" }: { text: string; onClear?: () => void; what?: string }) {
  return <div className="director-long-card" role="group" aria-label="长正文">
    <div><b>正文 {text.length.toLocaleString("zh-CN")} 字</b><small>太长，不在这里逐字编辑，{what}。整份都会保存，不截断。</small>
      {onClear && <button type="button" className="ip-brand-text-button" onClick={onClear}>清空，重新输入</button>}</div>
    <pre aria-label="正文开头">{text.slice(0, 1500)}{text.length > 1500 ? "\n……" : ""}</pre>
  </div>;
}
