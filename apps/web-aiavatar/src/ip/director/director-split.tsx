"use client";

import { useState } from "react";
import { BookMarked, ChevronRight, Scissors, Undo2, X } from "lucide-react";
import type { DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import type { WorkbenchProps } from "./director-workbench";
import { InlineError, clearDrafts, dialogFocus, useBusy, useDraft, useEscape } from "./director-shared";

/**
 * 分好、还没采用的分集：每集多长、从哪句开始到哪句结束，程序补过哪些段落、和要求哪里不一致。
 * 第一集之前的内容默认保留为设定资料（不拍），也可以并入第一集。确认后才生效。
 */
export function SplitPreview({ work, apply, setError }: Pick<WorkbenchProps, "work" | "apply" | "setError">) {
  const pending = work.pendingSplit!;
  const [preamble, setPreamble] = useState<"reference" | "episode">("reference");
  const { busy, run } = useBusy();
  const save = () => void run("save", async () => apply(await DirectorApi.edit(work.id, "split.save", pending.id, null, { preamble })), setError);
  const discard = () => void run("discard", async () => apply(await DirectorApi.edit(work.id, "split.discard", pending.id, null)), setError);
  const pre = pending.preamble;
  return <section className="director-split-preview" aria-label="确认分集">
    <header>
      <h4><Scissors size={15}/>分成 {pending.episodes.length} 集，确认后生效</h4>
      <p>{pending.source === "headings" ? "按剧本里标好的分集标题分，没有花积分。" : "AI 只划定每集范围，正文一个字都没改。"}</p>
    </header>
    {pre && <div className="director-split-preamble">
      <p><b>剧本开头 {pre.paragraphs} 段（{pre.chars.toLocaleString("zh-CN")} 字）不在任何一集里</b>
        <span title={`${pre.head} … ${pre.tail}`}>从「{pre.head}」到「{pre.tail}」</span></p>
      <div className="director-segmented" role="radiogroup" aria-label="剧本开头的内容">
        <button type="button" role="radio" aria-checked={preamble === "reference"} aria-pressed={preamble === "reference"} onClick={() => setPreamble("reference")}>是设定资料，不拍</button>
        <button type="button" role="radio" aria-checked={preamble === "episode"} aria-pressed={preamble === "episode"} onClick={() => setPreamble("episode")}>是正片，并入第 1 集</button>
      </div>
      <small>{preamble === "reference" ? "保留在「设定资料」里，提取资产和写分镜脚本时作为参考。以后也可以并入第 1 集。" : "放在第 1 集正文最前面，会被拍成画面。"}</small>
    </div>}
    {(pending.warnings.length > 0 || pending.notes.length > 0) && <ul className="director-split-notes">
      {pending.warnings.map(w => <li key={w} className="is-warn">{w}</li>)}
      {pending.notes.map(n => <li key={n}>{n}</li>)}
    </ul>}
    <ol className="director-split-episodes">{pending.episodes.map((e, i) =>
      <li key={e.startParagraph}>
        <b>第 {i + 1} 集</b>
        <span className="director-split-title" title={e.summary || e.title}>{e.title || `第 ${i + 1} 集`}</span>
        <small>{e.paragraphs} 段 · {e.chars.toLocaleString("zh-CN")} 字</small>
        <span className="director-split-range" title={`${e.head} … ${e.tail}`}>「{e.head}」…「{e.tail}」</span>
      </li>)}</ol>
    <div className="director-actions">
      <button type="button" className="ip-brand-button" disabled={!!busy} onClick={save}>确认分集</button>
      <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={discard}>不用这个结果</button>
    </div>
  </section>;
}

/** 设定资料：拆分时从剧本开头分出来的内容。可以改，也可以整段并入第 1 集。 */
export function ReferenceNotes({ work, apply, setError }: Pick<WorkbenchProps, "work" | "apply" | "setError">) {
  const key = `${work.id}:reference`;
  const [text, setText, dirty] = useDraft(key, work.reference);
  const [open, setOpen] = useState(false);
  const { busy, run } = useBusy();
  if (!work.reference.trim() && !dirty) return null;
  const save = () => void run("save", async () => { const next = await DirectorApi.edit(work.id, "reference.update", null, work.referenceRev, { text }); clearDrafts(key); apply(next); }, setError);
  const merge = () => void run("merge", async () => { const next = await DirectorApi.edit(work.id, "reference.toEpisode", null, work.referenceRev); clearDrafts(key); apply(next); }, setError);
  const chars = work.reference.replace(/\s/g, "").length;
  return <section className={`director-outline director-reference ${open ? "is-open" : ""}`} aria-label="设定资料">
    <button type="button" className="director-outline-head" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <BookMarked size={16}/><b>设定资料</b><span>{chars.toLocaleString("zh-CN")} 字 · 不拍成画面，提取资产和写分镜脚本时作为参考</span>
      {dirty && <em className="director-unsaved">未保存</em>}
      <ChevronRight size={16} className="director-outline-chevron"/>
    </button>
    {open && <div className="director-outline-body">
      <textarea className="director-script-text" aria-label="设定资料" value={text} maxLength={60000} onChange={e => setText(e.target.value)}/>
      <div className="director-actions">
        <button type="button" className="ip-brand-button" disabled={!dirty || !!busy} onClick={save}>{dirty ? "保存" : "已保存"}</button>
        {work.episodes.length > 0 && <button type="button" className="ip-brand-secondary" disabled={dirty || !!busy} title={dirty ? "先保存修改" : "这部分其实是正片：整段放到第 1 集最前面"} onClick={merge}>并入第 1 集</button>}
      </div>
    </div>}
  </section>;
}

/** 撤销拆分：回到拆分前的整份剧本。已有分镜图或视频时服务端不让撤，按钮也不出现。 */
export function UndoSplit({ work, apply, setError }: Pick<WorkbenchProps, "work" | "apply" | "setError">) {
  const [open, setOpen] = useState(false);
  if (!work.canUndoSplit) return null;
  return <>
    <button type="button" className="ip-brand-secondary" title="回到拆分前的整份剧本，可以重新拆分" onClick={() => setOpen(true)}><Undo2 size={14}/>撤销拆分</button>
    {open && <UndoDialog work={work} apply={apply} setError={setError} onClose={() => setOpen(false)}/>}
  </>;
}

function UndoDialog({ work, apply, setError, onClose }: Pick<WorkbenchProps, "work" | "apply" | "setError"> & { onClose: () => void }) {
  const [error, setLocalError] = useState("");
  const { busy, run } = useBusy();
  useEscape(() => { if (!busy) onClose(); });
  const planned = work.clips.length;
  const go = () => void run("undo", async () => {
    const next = await DirectorApi.edit(work.id, "split.undo", null, null);
    clearDrafts(`${work.id}:ep:`); // 各集没保存的修改跟着分集一起作废
    apply(next); onClose();
  }, e => { setLocalError(e); setError(""); });
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog" role="dialog" aria-modal="true" aria-labelledby="director-undo-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-undo-title">撤销拆分</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={!!busy}><X size={18}/></button></header>
      <ul className="director-regen-notes">
        <li>剧本回到拆分前的样子，{work.episodes.length} 集合回一整份，可以重新拆分或作为一集。</li>
        <li>拆分后在各集里改过的内容{planned ? `和已写好的 ${planned} 个片段` : ""}会一起清掉。</li>
        {work.assets.length > 0 && <li>已有的 {work.assets.length} 项资产保留。</li>}
      </ul>
      <InlineError message={error}/>
      <footer>
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy} onClick={go}>{busy ? "撤销中" : "撤销拆分"}</button>
      </footer>
    </div>
  </div>;
}

/** 剧本里已经标好分集：按标题分，不花积分（用户填了不同的集数就交给 AI）。 */
export function splitsByHeadings(work: DirectorWork, count: string) {
  const n = work.draftEpisodeHeadings;
  return n >= 2 && (!count || Number(count) === n);
}
