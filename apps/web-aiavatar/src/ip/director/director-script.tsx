"use client";

import { useState } from "react";
import { ChevronRight, Loader2, PenLine, RefreshCw, Scissors, Sparkles, Wand2, X } from "lucide-react";
import type { DirectorEpisode, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import type { WorkbenchProps } from "./director-workbench";
import { AiWorking, Field, InlineError, chooseDirectorBilling, clearDrafts, costText, hasDrafts, newRequestId, runningTask, useBusy, useDraft, useEscape, dialogFocus } from "./director-shared";

export function DirectorScript(props: WorkbenchProps) {
  const { work, episodeId } = props;
  const writing = runningTask(work, "script");
  const splitting = runningTask(work, "split");
  const textError = work.textError && ["script", "split"].includes(work.textError.task ?? "") ? work.textError.message : null;
  if (work.episodes.length > 0) return <EpisodeList {...props}/>;
  if (writing && !work.draft.trim() && work.episodes.length === 0) return <AiWorking title="AI 正在写剧本" task={writing}
    detail={`按创意设计人物、伏笔和反转，再分场写成剧本${styleText(work) ? `（${styleText(work)}）` : ""}。创意：${work.idea}`}/>;
  if (!work.draft.trim()) return <><InlineError message={textError}/><StartScript {...props}/></>;
  return <><InlineError message={textError}/><DraftEditor key={work.draftRev} {...props} splitting={!!splitting}/></>;
}

/** 题材与调性：与服务端 DirectorPrompts.GENRES / TONES 一一对应，选了就给编剧追加那一组规则。 */
const GENRES = ["都市悬疑", "市井情感", "奇幻脑洞", "职场现实", "民国谍战", "校园青春"] as const;
const TONES = ["反转烧脑", "治愈温情", "爽感打脸", "黑色幽默", "细思极恐"] as const;

function styleText(work: Pick<DirectorWork, "genre" | "tone">) {
  return [work.genre, work.tone].filter(Boolean).join(" · ");
}

function Chips({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return <div className="director-field"><span>{label}</span><div className="director-chips" role="group" aria-label={label}>
    <button type="button" aria-pressed={!value} onClick={() => onChange("")}>不限</button>
    {options.map(o => <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? "" : o)}>{o}</button>)}
  </div></div>;
}

function GenreTone({ genre, tone, setGenre, setTone }: { genre: string; tone: string; setGenre: (v: string) => void; setTone: (v: string) => void }) {
  return <><Chips label="题材" options={GENRES} value={genre} onChange={setGenre}/><Chips label="调性" options={TONES} value={tone} onChange={setTone}/></>;
}

/** 还没有剧本：新建时给了创意，这里就接着确认创意、生成剧本；没给创意（或用户改主意）才是粘贴剧本。 */
function StartScript({ work, apply, setError, openSettings }: WorkbenchProps & { openSettings?: () => void }) {
  const [idea, setIdea] = useDraft(`${work.id}:idea`, work.idea);
  const [paste, setPaste] = useDraft(`${work.id}:paste`, "");
  const [mode, setMode] = useState<"idea" | "paste">(() => work.idea.trim() || !paste ? "idea" : "paste");
  const [genre, setGenre] = useState(work.genre ?? "");
  const [tone, setTone] = useState(work.tone ?? "");
  const { busy, run } = useBusy();
  const write = () => void run("write", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("script", cost);
    const next = await DirectorApi.runTask(work.id, { type: "script", clientRequestId: newRequestId(), options: { idea: idea.trim(), genre, tone }, billing, maxCost: cost });
    clearDrafts(`${work.id}:idea`); apply(next);
  }, setError);
  const save = () => void run("paste", async () => { const next = await DirectorApi.patchWork(work.id, { draft: paste, draftRev: work.draftRev }); clearDrafts(`${work.id}:paste`); apply(next); }, setError);
  if (mode === "paste") return <section className="director-panel director-start">
    <h3><PenLine size={16}/>粘贴剧本</h3>
    <Field label="剧本正文" hint="免费。保存后可直接作为一集，或由 AI 拆分为多集。">
      <textarea rows={10} maxLength={60000} value={paste} onChange={e => setPaste(e.target.value)} placeholder="场次、动作与对白" autoFocus/>
    </Field>
    <div className="director-actions">
      <button type="button" className="ip-brand-button" disabled={!!busy || !paste.trim()} onClick={save}>保存剧本</button>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" onClick={() => setMode("idea")}>返回，用创意生成</button>
    </div>
  </section>;
  return <section className="director-panel director-start">
    <h3><Sparkles size={16}/>确认创意，生成剧本</h3>
    <Field label="创意" hint="AI 按这段创意写分场剧本。写明时长、集数、人物或「不要对白」等要求，会照做；没写的按 3 集、每集 60–90 秒。">
      <textarea rows={5} maxLength={2000} value={idea} onChange={e => setIdea(e.target.value)} placeholder="例如：凌晨的快递分拣站，夜班分拣员周小满发现一个寄给十年后自己的包裹。"/>
    </Field>
    <GenreTone genre={genre} tone={tone} setGenre={setGenre} setTone={setTone}/>
    <div className="director-start-settings">
      <span><small>画面风格</small>{work.settings.style}</span>
      <span><small>画幅</small>{work.settings.aspectRatio}</span>
      {openSettings && <button type="button" className="ip-brand-text-button" onClick={openSettings}>修改</button>}
    </div>
    <div className="director-actions">
      <button type="button" className="ip-brand-button" disabled={!!busy || !idea.trim()} onClick={write}>{busy === "write" ? <><Loader2 size={15} className="ip-loading-icon"/>提交中</> : <><Sparkles size={15}/>生成剧本</>}</button>
      <span className="director-cost">{work.pricing.mock ? costText(0, true) : `最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分，按用量结算`}</span>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" onClick={() => setMode("paste")}>已有剧本？改为粘贴</button>
    </div>
  </section>;
}

function DraftEditor({ work, apply, setError, splitting }: WorkbenchProps & { splitting: boolean }) {
  const draftKey = `${work.id}:draft`;
  const [text, setText, dirty] = useDraft(draftKey, work.draft);
  const [count, setCount] = useState("");
  const { busy, run } = useBusy();
  const persist = async () => { const w = await DirectorApi.patchWork(work.id, { draft: text, draftRev: work.draftRev }); clearDrafts(draftKey); return w; };
  const save = () => run("save", async () => apply(await persist()), setError);
  const asEpisode = () => void run("one", async () => {
    let w = work;
    if (dirty) w = await persist();
    apply(await DirectorApi.edit(w.id, "draft.asEpisode", null, null));
  }, setError);
  const split = () => void run("split", async () => {
    let w = work;
    if (dirty) { w = await persist(); apply(w); }
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("script", cost);
    apply(await DirectorApi.runTask(w.id, { type: "split", clientRequestId: newRequestId(), options: count ? { episodeCount: Number(count) } : {}, billing, maxCost: cost }));
  }, setError);
  const rewriting = runningTask(work, "script");
  return <section className="director-panel">
    <div className="director-panel-head"><h3>剧本</h3>{work.logline && <p>{work.logline}</p>}</div>
    {rewriting && <AiWorking compact title="AI 正在重新写剧本" task={rewriting} detail="写好后替换下面的剧本，当前版本保留在历史中。"/>}
    {splitting && <AiWorking compact title="AI 正在拆分集" task={runningTask(work, "split")} detail="只划定每集范围，正文保持不变。"/>}
    <textarea className="director-script-text" aria-label="剧本正文" value={text} onChange={e => setText(e.target.value)} disabled={splitting} maxLength={60000}/>
    <div className="director-actions">
      <button type="button" className="ip-brand-secondary" disabled={!dirty || !!busy || splitting} onClick={() => void save()}>{dirty ? "保存" : "已保存"}</button>
      {dirty && <span className="director-unsaved">未保存</span>}
      <span className="director-spacer"/>
      {!splitting && work.idea.trim() && <RegenerateScript work={work} apply={apply} setError={setError}/>}
      {splitting ? null : <>
        <button type="button" className="ip-brand-secondary" disabled={!!busy || !text.trim()} onClick={asEpisode}>作为一集</button>
        <label className="director-inline-field">分为<input inputMode="numeric" value={count} placeholder="自动" onChange={e => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))}/>集</label>
        <button type="button" className="ip-brand-button" disabled={!!busy || !text.trim()} onClick={split}><Scissors size={15}/>AI 拆分</button>
        <span className="director-cost">{costText(work.pricing.textMax, work.pricing.mock)}</span>
      </>}
    </div>
    <p className="director-dialog-note">拆分只划定每集范围，不改写正文。拆分后在左侧选择分集编辑。</p>
  </section>;
}

/** 全部集一个视图：一集一行，点开原地编辑，可同时展开几集；资产一次按全剧提取。 */
function EpisodeList(props: WorkbenchProps) {
  const { work, episodeId, apply, setError } = props;
  // 默认展开当前集（还没选过就第一集），以及有没保存修改的集。
  const [open, setOpen] = useState<Set<string>>(() => new Set(work.episodes.filter(e => e.id === (episodeId ?? work.episodes[0]?.id) || hasDrafts(`${work.id}:ep:${e.id}:`)).map(e => e.id)));
  const { busy, run } = useBusy();
  const extracting = work.tasks.find(t => t.status === "running" && t.target.startsWith("extract"));
  const extractError = work.textError?.task === "extract" ? work.textError.message : null;
  const chars = work.episodes.reduce((n, e) => n + e.content.replace(/\s/g, "").length, 0);
  const allOpen = open.size === work.episodes.length;
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const extract = () => void run("extract", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("asset-extract", cost);
    apply(await DirectorApi.runTask(work.id, { type: "extract", targetId: null, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, setError);
  return <section className="director-panel director-script-list">
    <div className="director-toolbar">
      <div className="director-toolbar-copy"><h3>剧本</h3><p>{work.episodes.length} 集 · 共 {chars.toLocaleString("zh-CN")} 字{work.logline ? ` · ${work.logline}` : ""}</p></div>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" onClick={() => setOpen(allOpen ? new Set() : new Set(work.episodes.map(e => e.id)))}>{allOpen ? "收起全部" : "展开全部"}</button>
      {work.idea.trim() && <RegenerateScript work={work} apply={apply} setError={setError}/>}
      {extracting ? null : <>
        <button type="button" className="ip-brand-button" disabled={!!busy} onClick={extract} title="对全部集一起提取角色、场景和道具，同一人物不会在各集重复出现">
          <Wand2 size={15}/>{work.assets.length ? "重新提取全剧资产" : "提取全剧资产"}</button>
        <span className="director-cost">{costText(work.pricing.textMax, work.pricing.mock)}</span>
      </>}
    </div>
    {runningTask(work, "script") && <AiWorking compact title="AI 正在重新写剧本" task={runningTask(work, "script")} detail="写好后替换当前剧本和分集，当前版本保留在历史中。"/>}
    {extracting && <AiWorking compact title="AI 正在提取全剧资产" task={extracting} detail="识别角色、场景和道具，完成后先给你确认，再保存到资产库。"/>}
    <InlineError message={extractError}/>
    <ol className="director-episode-list">{work.episodes.map(e =>
      <EpisodeRow key={e.id + ":" + e.rev} {...props} ep={e} open={open.has(e.id)} onToggle={() => toggle(e.id)}/>)}</ol>
  </section>;
}

function EpisodeRow({ work, ep, apply, setError, goTab, open, onToggle }: WorkbenchProps & { ep: DirectorEpisode; open: boolean; onToggle: () => void }) {
  const prefix = `${work.id}:ep:${ep.id}:`;
  const [title, setTitle, t] = useDraft(prefix + "title", ep.title);
  const [summary, setSummary, s] = useDraft(prefix + "summary", ep.summary);
  const [content, setContent, c] = useDraft(prefix + "content", ep.content);
  const { busy, run } = useBusy();
  const dirty = t || s || c;
  const save = () => void run("save", async () => {
    const next = await DirectorApi.edit(work.id, "episode.update", ep.id, ep.rev, { title, summary, content });
    clearDrafts(prefix); apply(next);
  }, setError);
  const clips = work.clips.filter(x => x.episodeId === ep.id);
  const progress = clips.length ? `分镜图 ${clips.filter(x => x.board.adoptedId).length}/${clips.length} · 视频 ${clips.filter(x => x.video.adoptedId).length}/${clips.length}` : "待规划";
  return <li className={`director-episode-item ${open ? "is-open" : ""}`}>
    <button type="button" className="director-episode-row" aria-expanded={open} onClick={onToggle}>
      <ChevronRight size={16} className="director-episode-chevron"/>
      <b>第 {ep.no} 集</b>
      <span className="director-episode-name" title={ep.title}>{ep.title}</span>
      <span className="director-episode-summary" title={ep.summary}>{ep.summary}</span>
      {dirty && <em className="director-unsaved">未保存</em>}
      <small>{ep.content.replace(/\s/g, "").length.toLocaleString("zh-CN")} 字 · {progress}</small>
    </button>
    {open && <div className="director-episode-body">
      <div className="director-two">
        <Field label="集名"><input value={title} maxLength={60} onChange={e => setTitle(e.target.value)}/></Field>
        <Field label="本集摘要"><input value={summary} maxLength={1000} onChange={e => setSummary(e.target.value)}/></Field>
      </div>
      {ep.planStale && <div className="director-warn">正文在规划后有修改，片段可能与正文不一致。可在「分镜」重新规划（已有分镜图的片段需先删除）。<button type="button" onClick={() => goTab("storyboard")}>前往分镜</button></div>}
      <textarea className="director-script-text" aria-label={`第 ${ep.no} 集正文`} value={content} maxLength={60000} onChange={e => setContent(e.target.value)}/>
      <div className="director-actions">
        <button type="button" className="ip-brand-button" disabled={!dirty || !!busy} onClick={save}>{dirty ? "保存" : "已保存"}</button>
        {dirty && <button type="button" className="ip-brand-text-button" onClick={() => { setTitle(ep.title); setSummary(ep.summary); setContent(ep.content); }}>撤销</button>}
      </div>
    </div>}
  </li>;
}

/** 重新生成剧本：可改创意；会替换剧本和分集，资产保留；已有分镜图或视频的片段时不能用。 */
export function RegenerateScript({ work, apply, setError }: Pick<WorkbenchProps, "work" | "apply" | "setError">) {
  const [open, setOpen] = useState(false);
  const blocked = work.clips.some(c => c.board.candidates.length || c.video.candidates.length);
  const writing = runningTask(work, "script");
  if (writing) return null;
  return <>
    <button type="button" className="ip-brand-secondary" disabled={blocked} title={blocked ? "已有分镜图或视频的片段，先删除这些片段才能重新生成剧本" : "按创意让 AI 重新写一版剧本"} onClick={() => setOpen(true)}><RefreshCw size={14}/>重新生成剧本</button>
    {open && <RegenerateDialog work={work} apply={apply} setError={setError} onClose={() => setOpen(false)}/>}
  </>;
}

function RegenerateDialog({ work, apply, setError, onClose }: Pick<WorkbenchProps, "work" | "apply" | "setError"> & { onClose: () => void }) {
  const [idea, setIdea] = useState(work.idea);
  const [genre, setGenre] = useState(work.genre ?? "");
  const [tone, setTone] = useState(work.tone ?? "");
  const [error, setLocalError] = useState("");
  const { busy, run } = useBusy();
  useEscape(() => { if (!busy) onClose(); });
  const hasEpisodes = work.episodes.length > 0;
  const go = () => void run("regen", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("script", cost);
    apply(await DirectorApi.runTask(work.id, { type: "script", clientRequestId: newRequestId(), options: { idea: idea.trim(), genre, tone, regenerate: true }, billing, maxCost: cost }));
    onClose();
  }, e => { setLocalError(e); setError(""); });
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog" role="dialog" aria-modal="true" aria-labelledby="director-regen-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-regen-title">重新生成剧本</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={!!busy}><X size={18}/></button></header>
      <label className="director-field"><span>创意</span>
        <textarea rows={5} maxLength={2000} value={idea} onChange={e => setIdea(e.target.value)}/>
        <small>写明时长、集数、人物或「不要对白」等要求，会照做。</small>
      </label>
      <GenreTone genre={genre} tone={tone} setGenre={setGenre} setTone={setTone}/>
      <ul className="director-regen-notes">
        <li>新剧本会替换当前{hasEpisodes ? `的剧本和 ${work.episodes.length} 集分集（片段一并清除）` : "剧本"}，旧版本保留在历史中。</li>
        {work.assets.length > 0 && <li>已有的 {work.assets.length} 项资产保留，生成后需要重新拆分并提取资产。</li>}
        <li>生成期间如果改了剧本或片段，新剧本不会替换当前内容。</li>
      </ul>
      <InlineError message={error}/>
      <footer>
        <small className="director-cost">{work.pricing.mock ? costText(0, true) : `最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分，按用量结算`}</small>
        <span className="director-spacer"/>
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy || !idea.trim()} onClick={go}><Sparkles size={14}/>{busy ? "提交中" : "重新生成"}</button>
      </footer>
    </div>
  </div>;
}
