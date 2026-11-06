"use client";

// 每一集里的剧本：改分镜时对照本集正文，不用来回切到剧本页。
// 片段在正文里的位置只用真实依据（写分镜时记下的起始句，或台词逐字匹配），找不到就明说，不伪造定位。

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import type { DirectorEpisode, DirectorWork } from "@ai-star-eco/types";
import { AskAI } from "./director-assistant";
import { clipRanges, paragraphsWithOffsets } from "./director-text";

/** 剧本对照一次最多画多少段：再多就分批显示，避免长正文一次画几万个段落卡住页面。 */
const REF_PARAGRAPHS = 600;

export function ScriptReference({ work, ep, focusClipId, onCollapse, foldId }: { work: DirectorWork; ep: DirectorEpisode; focusClipId: string | null; onCollapse?: () => void; foldId?: string }) {
  const clips = useMemo(() => work.clips.filter(c => c.episodeId === ep.id), [work.clips, ep.id]);
  const ranges = useMemo(() => clipRanges(ep.content, clips), [ep.content, clips]);
  const paragraphs = useMemo(() => paragraphsWithOffsets(ep.content), [ep.content]);
  const [onlyFocus, setOnlyFocus] = useState(false);
  const focus = focusClipId ? clips.find(c => c.id === focusClipId) : undefined;
  const range = focus ? ranges.get(focus.id) : undefined;
  const first = useRef<HTMLParagraphElement>(null);
  useEffect(() => { first.current?.scrollIntoView?.({ block: "center", behavior: "smooth" }); }, [focusClipId, range?.start]);
  // 每段属于哪个片段（有位置的才标），左边标片段号。
  const owner = (start: number, end: number) => clips.find(c => { const r = ranges.get(c.id); return r && start < r.end && end > r.start; });
  const how = !focus ? null : !range ? (focus.sourceQuote ? "正文已修改，未找到此片段的起始句，以下为本集全文。" : "此片段未记录对应的正文位置，以下为本集全文。")
    : range.how === "quote" ? "按写分镜脚本时记录的起始句定位。" : "按台词在正文中匹配到的大致位置。";
  let marked = false;
  let prevOwner: string | undefined;
  const all = onlyFocus && range ? paragraphs.filter(p => p.start < range.end && p.end > range.start) : paragraphs;
  // 正文很长时只画对照片段附近的一截（几万个段落一起画会卡），上下各有「显示更多」。
  const center = range ? Math.max(0, all.findIndex(p => p.end > range.start)) : 0;
  const [more, setMore] = useState({ before: 0, after: 0 });
  useEffect(() => setMore({ before: 0, after: 0 }), [ep.id, focusClipId, onlyFocus]);
  const from = all.length <= REF_PARAGRAPHS ? 0 : Math.max(0, center - REF_PARAGRAPHS / 2 - more.before);
  const to = all.length <= REF_PARAGRAPHS ? all.length : Math.min(all.length, Math.max(center, REF_PARAGRAPHS / 2) + REF_PARAGRAPHS / 2 + more.after);
  const shown = all.slice(from, to);
  const chars = `${ep.content.replace(/\s/g, "").length.toLocaleString("zh-CN")} 字${ep.planStale ? " · 写分镜脚本后正文已修改" : ""}`;
  // 和其它可收起的块同一种写法：整行是开关，箭头在右。抽屉里没有收起，只显示标题。
  return <section className={`director-script-ref${onCollapse ? " director-outline is-open" : ""}`} aria-label={`第 ${ep.no} 集剧本`}>
    <header>
      {onCollapse
        ? <button type="button" id={foldId} className="director-outline-head" aria-expanded onClick={onCollapse}>
          <FileText size={16}/><b>本集剧本</b><span>{chars}</span><ChevronRight size={16} className="director-outline-chevron"/></button>
        : <div><b>本集剧本</b><small>{chars}</small></div>}
      <AskAI scope={{ kind: "script", episodeId: ep.id, focusAt: range?.start ?? 0 }} what={`第 ${ep.no} 集剧本`} hint="评价、续写、润色本集"/>
    </header>
    {focus && <div className="director-script-ref-focus">
      <span>正在对照：片段 {focus.order}{focus.title ? ` · ${focus.title}` : ""}</span>
      {range && <button type="button" className="ip-brand-text-button" onClick={() => setOnlyFocus(v => !v)}>{onlyFocus ? "查看全文" : "只看此段"}</button>}
      <small>{how}</small>
    </div>}
    {!focus && clips.length > 0 && <p className="director-muted director-script-ref-hint">点击片段卡上的「对照剧本」，此处将标出对应段落。</p>}
    <div className="director-script-ref-body">
      {from > 0 && <button type="button" className="ip-brand-text-button director-ref-more" onClick={() => setMore(m => ({ ...m, before: m.before + REF_PARAGRAPHS }))}>
        上方还有 {from.toLocaleString("zh-CN")} 段，显示更多</button>}
      {shown.length === 0 ? <p className="director-muted">本集暂无正文。</p> : shown.map(p => {
        const inFocus = !!range && p.start < range.end && p.end > range.start;
        const c = owner(p.start, p.end);
        const isFirst = inFocus && !marked;
        if (isFirst) marked = true;
        const startsClip = !!c && c.id !== prevOwner;
        prevOwner = c?.id;
        return <p key={p.start} ref={isFirst ? first : undefined} className={`${inFocus ? "is-focus" : ""} ${/^#+\s/.test(p.text) ? "is-heading" : ""}`}>
          {startsClip && <i title={`片段 ${c!.order} 从此处开始`}>{c!.order}</i>}{p.text.replace(/^#+\s*/, "")}
        </p>;
      })}
      {to < all.length && <button type="button" className="ip-brand-text-button director-ref-more" onClick={() => setMore(m => ({ ...m, after: m.after + REF_PARAGRAPHS }))}>
        下方还有 {(all.length - to).toLocaleString("zh-CN")} 段，显示更多</button>}
    </div>
  </section>;
}
