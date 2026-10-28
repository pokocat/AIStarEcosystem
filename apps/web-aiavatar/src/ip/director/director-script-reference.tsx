"use client";

// 分镜页的剧本预览：改分镜时对照本集剧本，不用来回切到剧本页。
// 片段在正文里的位置只用真实依据（写分镜时记下的起始句，或台词逐字匹配），找不到就明说，不伪造定位。

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, ListOrdered } from "lucide-react";
import type { DirectorEpisode, DirectorWork } from "@ai-star-eco/types";
import { useLayoutMode } from "@/shell/layout-mode";
import { AskAI } from "./director-assistant";
import { DirectorSheet } from "./director-shared";
import { clipRanges, paragraphsWithOffsets } from "./director-text";

const SIDE_KEY = "director-board-side";

/** 分镜页左栏：剧本 / 分集 两个视图。手机上剧本在抽屉里打开，不把片段卡挤到下面去。 */
export function StoryboardSide({ work, ep, focusClipId, episodes, sheetOpen, setSheetOpen }: {
  work: DirectorWork; ep: DirectorEpisode; focusClipId: string | null; episodes: React.ReactNode;
  sheetOpen: boolean; setSheetOpen: (open: boolean) => void;
}) {
  const layout = useLayoutMode();
  const [view, setView] = useState<"script" | "episodes">("script");
  useEffect(() => { try { const v = window.localStorage.getItem(SIDE_KEY); if (v === "episodes" || v === "script") setView(v); } catch { /* 默认剧本 */ } }, []);
  useEffect(() => { if (focusClipId) setView("script"); }, [focusClipId]);
  const pick = (v: "script" | "episodes") => { setView(v); try { window.localStorage.setItem(SIDE_KEY, v); } catch { /* 忽略 */ } };
  if (layout !== "desktop") return <>
    {episodes}
    <button type="button" className="ip-brand-secondary director-script-ref-open" onClick={() => setSheetOpen(true)}><FileText size={15}/>对照第 {ep.no} 集剧本</button>
    {sheetOpen && <DirectorSheet label="本集剧本" onClose={() => setSheetOpen(false)}><ScriptReference work={work} ep={ep} focusClipId={focusClipId}/></DirectorSheet>}
  </>;
  return <div className={`director-board-side is-${view}`}>
    <div className="director-segmented director-board-side-tabs" role="tablist" aria-label="左栏">
      <button type="button" role="tab" aria-selected={view === "script"} onClick={() => pick("script")}><FileText size={13}/>本集剧本</button>
      <button type="button" role="tab" aria-selected={view === "episodes"} onClick={() => pick("episodes")}><ListOrdered size={13}/>分集</button>
    </div>
    {view === "script" ? <ScriptReference work={work} ep={ep} focusClipId={focusClipId}/> : episodes}
  </div>;
}

export function ScriptReference({ work, ep, focusClipId }: { work: DirectorWork; ep: DirectorEpisode; focusClipId: string | null }) {
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
  const how = !focus ? null : !range ? (focus.sourceQuote ? "正文改过，找不到这个片段的起始句；下面是本集全文。" : "这个片段没有记录对应的正文位置（旧片段或拆出来的片段），下面是本集全文。")
    : range.how === "quote" ? "按写分镜时记下的起始句定位。" : "按台词在正文里找到的大致位置。";
  let marked = false;
  let prevOwner: string | undefined;
  const shown = onlyFocus && range ? paragraphs.filter(p => p.start < range.end && p.end > range.start) : paragraphs;
  return <section className="director-script-ref" aria-label={`第 ${ep.no} 集剧本`}>
    <header>
      <div><b>第 {ep.no} 集 · {ep.title}</b><small>{ep.content.replace(/\s/g, "").length.toLocaleString("zh-CN")} 字{ep.planStale ? " · 写分镜后正文改过" : ""}</small></div>
      <AskAI scope={{ kind: "script", episodeId: ep.id }} label="AI" title="和助手讨论这一集剧本"/>
    </header>
    {focus && <div className="director-script-ref-focus">
      <span>正在对照：片段 {focus.order}{focus.title ? ` · ${focus.title}` : ""}</span>
      {range && <button type="button" className="ip-brand-text-button" onClick={() => setOnlyFocus(v => !v)}>{onlyFocus ? "查看全文" : "只看这段"}</button>}
      <small>{how}</small>
    </div>}
    {!focus && clips.length > 0 && <p className="director-muted director-script-ref-hint">点片段卡上的「对照剧本」，这里会标出它对应的段落。</p>}
    <div className="director-script-ref-body">
      {shown.length === 0 ? <p className="director-muted">本集还没有正文。</p> : shown.map(p => {
        const inFocus = !!range && p.start < range.end && p.end > range.start;
        const c = owner(p.start, p.end);
        const isFirst = inFocus && !marked;
        if (isFirst) marked = true;
        const startsClip = !!c && c.id !== prevOwner;
        prevOwner = c?.id;
        return <p key={p.start} ref={isFirst ? first : undefined} className={`${inFocus ? "is-focus" : ""} ${/^#+\s/.test(p.text) ? "is-heading" : ""}`}>
          {startsClip && <i title={`片段 ${c!.order} 从这里开始`}>{c!.order}</i>}{p.text.replace(/^#+\s*/, "")}
        </p>;
      })}
    </div>
  </section>;
}
