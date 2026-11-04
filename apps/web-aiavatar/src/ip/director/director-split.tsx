"use client";

import { useState } from "react";
import { BookMarked, ChevronRight, Scissors, Undo2, X } from "lucide-react";
import type { DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import type { WorkbenchProps } from "./director-workbench";
import { InlineError, chooseDirectorBilling, clearDrafts, dialogFocus, failed, newRequestId, useBusy, useDraft, useEscape } from "./director-shared";
import { LargePasteNotice, usePasteGuard } from "./director-script-file";
import { EDIT_MAX, SectionedScript } from "./director-long-editor";

/** 和服务端 DirectorService.REFERENCE_PROMPT_MAX 一致：设定资料交给模型时只取前这么多字（后面写明省略）。 */
const REFERENCE_PROMPT_MAX = 12000;

/**
 * 分好、还没采用的分集：每集多长、从哪句开始到哪句结束，程序补过哪些段落、和要求哪里不一致。
 * 第一集之前的内容默认保留为设定资料（不拍），也可以并入第一集。确认后才生效。
 */
export function SplitPreview({ work, apply, setError }: Pick<WorkbenchProps, "work" | "apply" | "setError">) {
  const pending = work.pendingSplit!;
  const [preamble, setPreamble] = useState<"reference" | "episode">("reference");
  const { busy, run } = useBusy();
  const save = () => void run("save", async () => apply(await DirectorApi.edit(work.id, "split.save", pending.id, null, { preamble })), failed(setError, "采用这次分集"));
  const discard = () => void run("discard", async () => apply(await DirectorApi.edit(work.id, "split.discard", pending.id, null)), failed(setError, "放弃这次分集"));
  const pre = pending.preamble;
  return <section className="director-split-preview" aria-label="确认分集">
    <header>
      <h4><Scissors size={15}/>分成 {pending.episodes.length} 集，确认后生效</h4>
      <p>{pending.source === "headings" ? "已按剧本中的分集标题拆分，未消耗积分。"
        : pending.source === "marker" ? `已按分集标题「${pending.marker ?? ""}」的格式拆分，未消耗积分。结果有误可放弃后重新填写。`
        : "AI 已划定每集范围，正文未做修改。"}</p>
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

/** 和服务端 DirectorPrompts.MARKER_MAX_CHARS 一致。 */
const MARKER_MAX = 60;
/** 弹窗里的剧本预览只用来找第 1 集的标题行，只放开头这么多字：剧本正文不限长，整份放进弹窗打开会卡。 */
const SOURCE_PREVIEW_MAX = 30000;

/**
 * 程序没认出分集标题时，拆分前先问一句：剧本已经分好集就填每集标题的开头，按标题免费分；
 * 还没分集才交给 AI。不先问的话，分好集的长剧本整份交给模型，集数多了会被截断（2026-11-03《我的十年》）。
 */
export function SplitChoiceDialog({ work, count, apply, onClose }: { work: DirectorWork; count: string; apply: (w: DirectorWork) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"marker" | "model">();
  const [marker, setMarker] = useState("");
  const [error, setLocalError] = useState("");
  const { busy, run } = useBusy();
  useEscape(() => { if (!busy) onClose(); });
  const episodeCount = count ? { episodeCount: Number(count) } : {};
  const ready = mode === "model" || (mode === "marker" && !!marker.trim());
  const go = () => void run("split", async () => {
    setLocalError("");
    const next = mode === "marker"
      ? await DirectorApi.runTask(work.id, { type: "split", clientRequestId: newRequestId(), options: { ...episodeCount, marker: marker.trim() }, maxCost: 0 })
      : await DirectorApi.runTask(work.id, { type: "split", clientRequestId: newRequestId(), options: episodeCount,
        billing: await chooseDirectorBilling("script"), maxCost: work.pricing.textMax });
    apply(next);
    onClose();
  }, setLocalError);
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog director-split-choice" role="dialog" aria-modal="true" aria-labelledby="director-split-choice-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-split-choice-title">选择拆分方式</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={!!busy}><X size={18}/></button></header>
      <p className="director-dialog-note">未在剧本中识别到分集标题。系统可自动识别「第1集」「第一集」「E01」「EP01」「Episode 1」格式（每集标题独占一行），其他格式请按下方方式拆分。拆分结果确认后生效。</p>
      <div className="director-split-choice-body">
        <div className="director-split-choice-form">
          <div className="director-field" role="radiogroup" aria-label="拆分方式">
            <span>拆分方式</span>
            <label className="director-check">
              <input type="radio" name="director-split-mode" checked={mode === "marker"} onChange={() => setMode("marker")}/>
              <span><b>按分集标题拆分</b>
                <small>适用于已分好集的剧本。填写第 1 集的标题行，系统按相同格式依次查找后续各集。不消耗积分。</small></span>
            </label>
            {mode === "marker" && <label className="director-field director-split-marker">
              <span>第 1 集标题行<em>需包含编号</em></span>
              <input autoFocus value={marker} maxLength={MARKER_MAX} disabled={!!busy} placeholder="例如：1 不想打工了、Chapter 1、第1章"
                onChange={e => { setMarker(e.target.value); setLocalError(""); }} onKeyDown={e => { if (e.key === "Enter" && ready) go(); }}/>
            </label>}
            <label className="director-check">
              <input type="radio" name="director-split-mode" checked={mode === "model"} onChange={() => setMode("model")}/>
              <span><b>AI 按剧情拆分</b>
                <small>适用于尚未分集的剧本。AI 根据剧情划定每集范围{count ? `，目标 ${count} 集` : ""}，不修改正文。{work.pricing.mock ? "" : "按实际用量结算。"}集数较多（如几十集）时可能无法完成，此类剧本建议按分集标题拆分。</small></span>
            </label>
          </div>
          <InlineError message={error}/>
        </div>
        <section className="director-split-source" aria-label="剧本预览">
          <div className="director-split-source-head">
            <b>剧本预览</b>
            <small>共 {work.draft.length.toLocaleString("zh-CN")} 字{work.draft.length > SOURCE_PREVIEW_MAX ? `，显示前 ${SOURCE_PREVIEW_MAX.toLocaleString("zh-CN")} 字` : ""}</small>
          </div>
          {mode === "marker" && <small>选中第 1 集的标题行，复制后粘贴到输入框。</small>}
          <div className="director-split-source-text" tabIndex={0}>{work.draft.slice(0, SOURCE_PREVIEW_MAX)}</div>
        </section>
      </div>
      <footer>
        {!busy && !ready && <small className="director-split-choice-hint">{mode === "marker" ? "请填写第 1 集标题行" : "请选择拆分方式"}</small>}
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy || !ready} onClick={go}><Scissors size={14}/>
          {busy ? "提交中" : mode === "model" ? "AI 拆分" : "按标题拆分"}</button>
      </footer>
    </div>
  </div>;
}

/** 设定资料：拆分时从剧本开头分出来的内容。可以改，也可以整段并入第 1 集。 */
export function ReferenceNotes({ work, apply, setError }: Pick<WorkbenchProps, "work" | "apply" | "setError">) {
  const key = `${work.id}:reference`;
  const [text, setText, dirty] = useDraft(key, work.reference);
  const [open, setOpen] = useState(false);
  const { busy, run } = useBusy();
  const guard = usePasteGuard();
  if (!work.reference.trim() && !dirty) return null;
  const save = () => void run("save", async () => { const next = await DirectorApi.edit(work.id, "reference.update", null, work.referenceRev, { text }); clearDrafts(key); apply(next); }, failed(setError, "保存设定资料", "改动还在编辑框里，按原因调整后再保存。"));
  const merge = () => void run("merge", async () => { const next = await DirectorApi.edit(work.id, "reference.toEpisode", null, work.referenceRev); clearDrafts(key); apply(next); }, failed(setError, "把设定资料并入第 1 集"));
  const chars = work.reference.replace(/\s/g, "").length;
  return <section className={`director-outline director-reference ${open ? "is-open" : ""}`} aria-label="设定资料">
    <button type="button" className="director-outline-head" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <BookMarked size={16}/><b>设定资料</b><span>{chars.toLocaleString("zh-CN")} 字 · 不拍成画面，提取资产和写分镜脚本时作为参考</span>
      {dirty && <em className="director-unsaved">未保存</em>}
      <ChevronRight size={16} className="director-outline-chevron"/>
    </button>
    {open && <div className="director-outline-body">
      {text.length > EDIT_MAX ? <SectionedScript value={text} onChange={setText} label="设定资料" onPaste={guard.onPaste}/>
        : <textarea className="director-script-text" aria-label="设定资料" value={text} onChange={e => setText(e.target.value)} onPaste={guard.onPaste}/>}
      {guard.blocked && <LargePasteNotice chars={guard.blocked.chars} onClose={guard.clear}
        onInsert={t => { const b = guard.blocked!; setText(text.slice(0, b.start) + t + text.slice(b.end)); }}/>}
      {text.length > REFERENCE_PROMPT_MAX && <p className="director-long-note" role="note">设定资料 {text.length.toLocaleString("zh-CN")} 字，照常保存；提取资产和写分镜脚本时 AI 只参考前 {REFERENCE_PROMPT_MAX.toLocaleString("zh-CN")} 字，要紧的设定请放在前面。</p>}
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
