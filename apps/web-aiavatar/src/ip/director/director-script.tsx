"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, ChevronRight, Loader2, MessageSquare, PenLine, RefreshCw, Scissors, Sparkles, Wand2, X } from "lucide-react";
import type { DirectorAssistantScope, DirectorEpisode, DirectorProposal, DirectorWork } from "@ai-star-eco/types";
import { AiMark } from "../studio-ai-icon";
import { AiField, proposalImpacts, useAssistant } from "./director-assistant";
import { proposalRange } from "./director-text";
import { BriefChat } from "./director-brief";
import { clearPending, readPending } from "./director-pending";
import { DirectorApi } from "../api";
import type { WorkbenchProps } from "./director-workbench";
import { DirectorScriptFile, LargePasteNotice, usePasteGuard, type ScriptFileHandle } from "./director-script-file";
import { EDIT_MAX, LongTextCard, SectionedScript } from "./director-long-editor";
import { ReferenceNotes, SplitPreview, UndoSplit, splitsByHeadings } from "./director-split";
import { AiWorking, Field, GrowTextarea, InlineError, chooseDirectorBilling, clearDrafts, failed, hasDrafts, newRequestId, runningTask, saveDrafts, useBusy, useDraft, useEscape, dialogFocus } from "./director-shared";

export function DirectorScript(props: WorkbenchProps) {
  const { work, episodeId } = props;
  // 创意对话 / 跳过生成的请求记录：作品显示服务端已经收到，就清掉（创意对话界面这时可能没挂载）。
  useEffect(() => {
    const key = `director-brief:pending:${work.id}`;
    const p = readPending<{ type: string; clientRequestId: string }>(key);
    if (!p) return;
    const got = p.body.type === "brief" ? !!work.brief?.messages.some(m => m.clientId === p.body.clientRequestId)
      : work.brief?.status === "writing" || work.brief?.status === "done" || !!work.draft.trim() || work.episodes.length > 0;
    if (got) clearPending(key);
  }, [work]);
  const writing = runningTask(work, "script");
  const splitting = runningTask(work, "split");
  const textError = work.textError && ["script", "split"].includes(work.textError.task ?? "") ? work.textError.message : null;
  if (work.episodes.length > 0) return <EpisodeList {...props}/>;
  if (writing && !work.draft.trim() && work.episodes.length === 0) return <AiWorking title="AI 正在写剧本" task={writing}
    detail={`${work.brief?.messages.some(m => m.role === "user") ? "按你们聊定的要求" : "按创意"}设计人物、伏笔和反转，再分场写成剧本${styleText(work) ? `（${styleText(work)}）` : ""}。创意：${work.idea}`}/>;
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

export function GenreTone({ genre, tone, setGenre, setTone }: { genre: string; tone: string; setGenre: (v: string) => void; setTone: (v: string) => void }) {
  return <><Chips label="题材" options={GENRES} value={genre} onChange={setGenre}/><Chips label="调性" options={TONES} value={tone} onChange={setTone}/></>;
}

/**
 * 还没有剧本：默认是写剧本前的创意对话（AI 问几轮把故事定下来，随时可以跳过直接写）；
 * 已有剧本的可以改为粘贴。
 */
function StartScript({ work, apply, setError, openSettings }: WorkbenchProps & { openSettings?: () => void }) {
  const [paste, setPaste] = useDraft(`${work.id}:paste`, "");
  const [mode, setMode] = useState<"idea" | "paste">(() => work.idea.trim() || !paste ? "idea" : "paste");
  const [reading, setReading] = useState(false);
  const { busy, run } = useBusy();
  const file = useRef<ScriptFileHandle>(null);
  const guard = usePasteGuard();
  const save = () => void run("paste", async () => { apply(await saveDrafts({ [`${work.id}:paste`]: paste }, () => DirectorApi.patchWork(work.id, { draft: paste, draftRev: work.draftRev }))); },
    failed(setError, "保存剧本", "粘贴的剧本还在输入框里，按原因调整后再点保存。"));
  if (mode === "paste") return <section className="director-panel director-start">
    <h3><PenLine size={16}/>粘贴或上传剧本</h3>
    <DirectorScriptFile ref={file} hasText={!!paste.trim()} disabled={!!busy} onImport={setPaste} onReadingChange={setReading}/>
    {paste.length > EDIT_MAX ? <LongTextCard text={paste} onClear={() => setPaste("")} what="保存后按段编辑"/>
      : <Field label="剧本正文" hint="免费。保存后可直接作为一集，或由 AI 拆分为多集。">
        <textarea rows={10} className="director-script-text" disabled={!!busy} value={paste} onChange={e => setPaste(e.target.value)} onPaste={guard.onPaste} placeholder="场次、动作与对白" autoFocus/>
      </Field>}
    {guard.blocked && <LargePasteNotice chars={guard.blocked.chars} onClose={guard.clear} onUpload={() => { guard.clear(); file.current?.open(); }}/>}
    <div className="director-actions">
      <button type="button" className="ip-brand-button" disabled={!!busy || reading || !paste.trim()} onClick={save}>保存剧本</button>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" disabled={!!busy || reading} onClick={() => setMode("idea")}>返回，用创意生成</button>
    </div>
  </section>;
  return <BriefChat work={work} apply={apply} setError={setError} openSettings={openSettings} onPaste={() => setMode("paste")}/>;
}

/** 整体故事大纲：先知道全剧在讲什么，再看分集正文。剧本生成时一起写，导入的剧本没有。 */
function StoryOutline({ work, defaultOpen = true }: { work: DirectorWork; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const o = work.outline;
  if (!o) return null;
  const rows: Array<[string, string]> = ([["世界观", o.world], ["主线", o.plot], ["反转与伏笔", o.reversals], ["主题", o.theme]] as Array<[string, string]>).filter(([, v]) => v?.trim());
  return <section className={`director-outline ${open ? "is-open" : ""}`} aria-label="故事大纲">
    <button type="button" className="director-outline-head" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <BookOpen size={16}/><b>故事大纲</b>{work.logline && <span title={work.logline}>{work.logline}</span>}
      <ChevronRight size={16} className="director-outline-chevron"/>
    </button>
    {open && <div className="director-outline-body">
      {o.characters.length > 0 && <div className="director-outline-people">{o.characters.map(c =>
        <article key={c.name}>
          <h4>{c.name}{(c.age || c.identity) && <small>{[c.age && (/\d$/.test(c.age) ? `${c.age} 岁` : c.age), c.identity].filter(Boolean).join(" · ")}</small>}</h4>
          {c.secret && c.secret !== "无" && <p><em>秘密</em>{c.secret}</p>}
          {c.flaw && <p><em>软肋</em>{c.flaw}</p>}
          {c.arc && <p><em>变化</em>{c.arc}</p>}
        </article>)}</div>}
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>}
  </section>;
}

/**
 * 剧本页的「下一步」：逐步做（正常路径）和一键制作（快捷方式）并排，位置固定在大纲下面、正文上面，
 * 拆分前后都在同一个地方，不会一会在上一会在下。
 */
function NextChoices({ work, title, desc, children, onShortcut, shortcutDesc, shortcutDisabled, shortcutNote }: { work: DirectorWork; title: string; desc: string; children: ReactNode;
  onShortcut: () => void; shortcutDesc: string; shortcutDisabled?: boolean; shortcutNote?: string }) {
  const live = !!work.pipeline && ["running", "waiting", "paused"].includes(work.pipeline.status);
  return <div className="director-next-choices" role="group" aria-label="下一步">
    <div className="is-main">
      <h4>{title}<small>推荐</small></h4>
      <p>{desc}</p>
      <div className="director-actions">{children}</div>
    </div>
    <div>
      <h4>或者：一键制作<small className="is-shortcut">快捷</small></h4>
      <p>{shortcutDesc}</p>
      <div className="director-actions">
        <button type="button" className="ip-brand-secondary" disabled={shortcutDisabled || live} onClick={onShortcut}><Sparkles size={15}/>一键制作</button>
        {(live ? "一键制作进行中，进度在上方" : shortcutNote) && <span className="director-muted">{live ? "一键制作进行中，进度在上方" : shortcutNote}</span>}
      </div>
    </div>
  </div>;
}

function DraftEditor({ work, apply, setError, splitting, startPipeline }: WorkbenchProps & { splitting: boolean }) {
  const locked = useAssistant()?.scriptLocked("draft") ?? false;
  const draftKey = `${work.id}:draft`;
  const [text, setText, dirty] = useDraft(draftKey, work.draft);
  const [count, setCount] = useState("");
  const { busy, run } = useBusy();
  const persist = () => saveDrafts({ [draftKey]: text }, () => DirectorApi.patchWork(work.id, { draft: text, draftRev: work.draftRev }));
  const save = () => run("save", async () => apply(await persist()), failed(setError, "保存剧本", "改动还在编辑框里，按原因调整后再保存。"));
  const asEpisode = () => void run("one", async () => {
    let w = work;
    if (dirty) w = await persist();
    apply(await DirectorApi.edit(w.id, "draft.asEpisode", null, null));
  }, failed(setError, "把剧本作为一集"));
  const split = () => void run("split", async () => {
    let w = work;
    if (dirty) { w = await persist(); apply(w); }
    // 剧本里标好了分集：服务端按标题分、不扣积分，不用选付款方。
    const free = splitsByHeadings(w, count);
    const cost = free ? 0 : work.pricing.textMax;
    const billing = free ? undefined : await chooseDirectorBilling("script");
    apply(await DirectorApi.runTask(w.id, { type: "split", clientRequestId: newRequestId(), options: count ? { episodeCount: Number(count) } : {}, billing, maxCost: cost }));
  }, failed(setError, "拆分集"));
  const byHeadings = splitsByHeadings(work, count);
  const rewriting = runningTask(work, "script");
  return <section className="director-panel director-script-list">
    <div className="director-toolbar">
      <div className="director-toolbar-copy"><h3>剧本</h3><p>{work.logline && !work.outline ? work.logline : "还没拆分集"}</p></div>
      <span className="director-spacer"/>
      {dirty && <span className="director-unsaved">未保存</span>}
      <button type="button" className="ip-brand-secondary" disabled={locked || !dirty || !!busy || splitting || !!rewriting} onClick={() => void save()}>{dirty ? "保存" : "已保存"}</button>
      {!splitting && work.idea.trim() && <RegenerateScript work={work} apply={apply} setError={setError}/>}
    </div>
    <div className="director-script-content" aria-label="剧本内容" aria-busy={!!rewriting}>
      {rewriting ? <AiWorking title="AI 正在重新写剧本" task={rewriting} detail="完成后自动显示新剧本，当前版本保留在历史中。"/> : <>
      <StoryOutline work={work}/>
      <ReferenceNotes work={work} apply={apply} setError={setError}/>
      {splitting ? <AiWorking compact title="AI 正在拆分集" task={runningTask(work, "split")} detail="只划定每集范围，正文保持不变。"/> :
        work.pendingSplit ? <SplitPreview key={work.pendingSplit.id} work={work} apply={apply} setError={setError}/> :
        <NextChoices work={work} shortcutDesc="从拆分集一路自动做到成片，也可以只做到分镜脚本或分镜图。系统先算好推荐预算，你确认后开始。" title="下一步：拆分集"
          desc={byHeadings ? `剧本里已经标好了 ${work.draftEpisodeHeadings} 集，按标题直接分，不花积分。开头不属于任何一集的内容会单独放进设定资料，确认后生效。`
            : "AI 按剧情把剧本拆成分集，只划定每集范围、不改正文。剧本开头的设定资料会单独保留。分好后先给你看，确认后生效。"}
          onShortcut={startPipeline} shortcutDisabled={locked || !!busy || !text.trim() || dirty} shortcutNote={dirty ? "先保存剧本" : undefined}>
          <label className="director-inline-field">分为<input inputMode="numeric" value={count} placeholder="自动" onChange={e => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))}/>集</label>
          <button type="button" className="ip-brand-button" disabled={locked || !!busy || !text.trim()} onClick={split}><Scissors size={15}/>{byHeadings ? "按标题分集" : "AI 拆分"}</button>
          <button type="button" className="ip-brand-secondary" disabled={locked || !!busy || !text.trim()} onClick={asEpisode}>作为一集</button>
          {byHeadings && <span className="director-cost">免费</span>}
        </NextChoices>}
      <ScriptText work={work} target="draft" label="剧本正文" what="剧本正文" value={text} onChange={setText} disabled={splitting}/>
      </>}
    </div>
  </section>;
}

/** 全部集一个视图：一集一行，点开原地编辑，可同时展开几集；资产一次按全剧提取。 */
function EpisodeList(props: WorkbenchProps) {
  const { work, episodeId, apply, setError, goTab, startPipeline } = props;
  // 默认展开当前集（还没选过就第一集），以及有没保存修改的集。
  const [open, setOpen] = useState<Set<string>>(() => new Set(work.episodes.filter(e => e.id === (episodeId ?? work.episodes[0]?.id) || hasDrafts(`${work.id}:ep:${e.id}:`)).map(e => e.id)));
  const { busy, run } = useBusy();
  // 助手的「预览修改」：展开那一集，让对比直接出现在正文处。
  const ctl = useAssistant();
  const previewTarget = ctl?.preview ? ctl.findProposal(ctl.preview.messageId, ctl.preview.proposalId)?.target : undefined;
  useEffect(() => {
    if (previewTarget && previewTarget !== "draft") setOpen(prev => prev.has(previewTarget) ? prev : new Set(prev).add(previewTarget));
  }, [previewTarget]);
  const extracting = work.tasks.find(t => t.status === "running" && t.target.startsWith("extract"));
  const extractError = work.textError?.task === "extract" ? work.textError.message : null;
  const rewriting = runningTask(work, "script");
  const chars = work.episodes.reduce((n, e) => n + e.content.replace(/\s/g, "").length, 0);
  const allOpen = open.size === work.episodes.length;
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const extract = () => void run("extract", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("asset-extract");
    apply(await DirectorApi.runTask(work.id, { type: "extract", targetId: null, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, failed(setError, work.assets.length ? "重新提取全剧资产" : "提取全剧资产"));
  return <section className="director-panel director-script-list">
    <div className="director-toolbar">
      <div className="director-toolbar-copy"><h3>剧本</h3><p>{work.episodes.length} 集 · 共 {chars.toLocaleString("zh-CN")} 字{work.logline && !work.outline ? ` · ${work.logline}` : ""}</p></div>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" disabled={!!rewriting} onClick={() => setOpen(allOpen ? new Set() : new Set(work.episodes.map(e => e.id)))}>{allOpen ? "收起全部" : "展开全部"}</button>
      <UndoSplit work={work} apply={apply} setError={setError}/>
      {work.idea.trim() && <RegenerateScript work={work} apply={apply} setError={setError}/>}
    </div>
    <div className="director-script-content" aria-label="剧本内容" aria-busy={!!rewriting}>
      {rewriting ? <AiWorking title="AI 正在重新写剧本" task={rewriting} detail="完成后自动显示新剧本和分集，当前版本保留在历史中。"/> : <>
      <StoryOutline work={work} defaultOpen={!work.assets.length}/>
      <ReferenceNotes work={work} apply={apply} setError={setError}/>
      {extracting ? <AiWorking compact title="AI 正在提取全剧资产" task={extracting} detail="识别角色、场景和道具，完成后先给你确认，再保存。"/> :
        <NextChoices work={work} shortcutDesc="把后面的步骤连着自动做完，一直到成片，也可以只做到分镜脚本或分镜图。系统先算好推荐预算，你确认后开始。" title={work.assets.length ? "下一步：生成资产图" : "下一步：提取全剧资产"}
          desc={work.assets.length ? `已提取 ${work.assets.length} 项资产。到「资产」给角色、场景和道具生成资产图，分镜图和视频都照着它们画。改了正文可以重新提取，同一人物不会重复新建。`
            : "AI 从全部集里识别角色、场景和道具，先给你确认清单再入库。之后生成资产图、写分镜脚本，每一步都能先看再改。"}
          onShortcut={startPipeline} shortcutDisabled={!!busy}>
          <button type="button" className={work.assets.length ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy} onClick={extract} title="对全部集一起提取角色、场景和道具，同一人物不会在各集重复出现">
            <Wand2 size={15}/>{work.assets.length ? "重新提取全剧资产" : "提取全剧资产"}</button>
          {work.assets.length > 0 && <button type="button" className="ip-brand-button" onClick={() => goTab("assets")}>前往资产</button>}
        </NextChoices>}
      <InlineError message={extractError}/>
      <ol className="director-episode-list">{work.episodes.map(e =>
        <EpisodeRow key={e.id + ":" + e.rev} {...props} ep={e} open={open.has(e.id)} onToggle={() => toggle(e.id)}/>)}</ol>
      </>}
    </div>
  </section>;
}

function EpisodeRow({ work, ep, apply, setError, goTab, open, onToggle }: WorkbenchProps & { ep: DirectorEpisode; open: boolean; onToggle: () => void }) {
  const locked = useAssistant()?.scriptLocked(ep.id) ?? false;
  const prefix = `${work.id}:ep:${ep.id}:`;
  const [title, setTitle, t] = useDraft(prefix + "title", ep.title);
  const [summary, setSummary, s] = useDraft(prefix + "summary", ep.summary);
  const [content, setContent, c] = useDraft(prefix + "content", ep.content);
  const { busy, run } = useBusy();
  const dirty = t || s || c;
  const save = () => void run("save", async () => {
    apply(await saveDrafts({ [prefix + "title"]: title, [prefix + "summary"]: summary, [prefix + "content"]: content },
      () => DirectorApi.edit(work.id, "episode.update", ep.id, ep.rev, { title, summary, content })));
  }, failed(setError, `保存第 ${ep.no} 集`, "改动还在编辑框里，按原因调整后再点「保存」。"));
  const clips = work.clips.filter(x => x.episodeId === ep.id);
  const progress = clips.length ? `分镜图 ${clips.filter(x => x.board.adoptedId).length}/${clips.length} · 视频 ${clips.filter(x => x.video.adoptedId).length}/${clips.length}` : "待写分镜";
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
        <Field label="集名"><input value={title} readOnly={locked} maxLength={60} onChange={e => { if (!locked) setTitle(e.target.value); }}/></Field>
        <Field label="本集摘要"><GrowTextarea className="director-summary-input" rows={2} value={summary} readOnly={locked} maxLength={1000} onChange={e => { if (!locked) setSummary(e.target.value); }}/></Field>
      </div>
      {ep.planStale && <div className="director-warn">分镜脚本写好后正文又改过，片段可能和正文对不上。可在「分镜」重写分镜脚本（已有分镜图的片段要先删掉）。<button type="button" onClick={() => goTab("storyboard")}>前往分镜</button></div>}
      <ScriptText work={work} target={ep.id} label={`第 ${ep.no} 集正文`} what={`第 ${ep.no} 集正文`} value={content} onChange={setContent}/>
      <div className="director-actions">
        <button type="button" className="ip-brand-button" disabled={locked || !dirty || !!busy} onClick={save}>{dirty ? "保存" : "已保存"}</button>
        {dirty && <button type="button" disabled={locked} className="ip-brand-text-button" onClick={() => { setTitle(ep.title); setSummary(ep.summary); setContent(ep.content); }}>撤销</button>}
      </div>
    </div>}
  </li>;
}

/** 重新生成剧本：可改创意；会替换剧本和分集，资产保留；已有分镜图或视频的片段时不能用。 */
export function RegenerateScript({ work, apply, setError }: Pick<WorkbenchProps, "work" | "apply" | "setError">) {
  const ctl = useAssistant();
  const [open, setOpen] = useState(false);
  const scriptBusy = !!ctl && ["draft", ...work.episodes.map(e => e.id)].some(ctl.scriptLocked);
  const blocked = work.clips.some(c => c.board.candidates.length || c.video.candidates.length) || scriptBusy;
  const writing = runningTask(work, "script");
  if (writing) return null;
  return <>
    <button type="button" className="ip-brand-secondary" disabled={blocked} title={scriptBusy ? "请等助手回复完成后再重新生成" : blocked ? "已有分镜图或视频的片段，先删除这些片段才能重新生成剧本" : "按创意让 AI 重新写一版剧本"} onClick={() => setOpen(true)}><RefreshCw size={14}/>重新生成剧本</button>
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
    const billing = await chooseDirectorBilling("script");
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
        <span className="director-spacer"/>
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy || !idea.trim()} onClick={go}><Sparkles size={14}/>{busy ? "提交中" : "重新生成"}</button>
      </footer>
    </div>
  </div>;
}

// ── 正文编辑区：选中文字后可以问助手；助手的剧本建议在这里预览对比 ─────────────────

/** 剧本正文。选中一段后顶部出现「问 AI / 润色 / 扩写」；有正在预览的助手建议时，换成原文与建议的对比。 */
function ScriptText({ work, target, label, what, value, onChange, disabled }: { work: DirectorWork; target: string; label: string; what: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ctl = useAssistant();
  const locked = ctl?.scriptLocked(target) ?? false;
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  // 长正文按段编辑时，编辑框里只有一段：选区、光标位置都要加上这一段的起点。
  const offset = useRef(0);
  const sectioned = value.length > EDIT_MAX;
  const paste = usePasteGuard(() => offset.current);
  const preview = ctl?.preview ? ctl.findProposal(ctl.preview.messageId, ctl.preview.proposalId) : undefined;
  const budget = work.pricing.textChars ?? 0, long = budget > 0 && value.length > budget;
  if (ctl?.preview && preview && preview.type === "script.replace" && preview.target === target && preview.status === "open")
    return <ScriptReview work={work} messageId={ctl.preview.messageId} p={preview} value={value} label={label}/>;
  const track = () => {
    const el = area.current;
    if (!el) return;
    setSel(el.selectionEnd - el.selectionStart >= 2 ? { start: offset.current + el.selectionStart, end: offset.current + el.selectionEnd } : null);
  };
  const selected = sel ? value.slice(sel.start, sel.end) : "";
  const askWith = (draft: string) => {
    if (!ctl || !selected.trim()) return;
    // 带上选区的具体位置：同样的话出现两处时，改的是选中的这一处。
    if (!sel || sel.end - sel.start > 6000) return;
    const scope: DirectorAssistantScope = { kind: "selection", episodeId: target, text: selected, start: sel.start, end: sel.end };
    ctl.ask(scope, draft);
  };
  return <div className="director-script-area">
    {locked && <p className="director-muted" role="status">AI 正在处理这份正文，暂时不能编辑。回复完成或失败后即可继续修改。</p>}
    {ctl && sel && selected.trim() && <div className="director-selection-bar" role="toolbar" aria-label="对选中的正文">
      <small>已选 {selected.replace(/\s/g, "").length} 字</small>
      {/* 按下不抢焦点，选区保持 */}
      <button type="button" className="is-ai" onMouseDown={e => e.preventDefault()} onClick={() => askWith("")}><AiMark size={12}/>问 AI</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => askWith("润色这段，保留原意和人物口吻，其他别动")}><PenLine size={13}/>润色</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => askWith("扩写这段，补上动作和细节，不改剧情走向")}><MessageSquare size={13}/>扩写</button>
    </div>}
    {/* 点下去时带上光标位置：正文很长时助手读光标附近那一段。 */}
    <AiField scope={() => ({ kind: "script", episodeId: target, focusAt: offset.current + (area.current?.selectionStart ?? 0) })} what={what}
      hint={long ? `评价、续写、润色。正文很长，助手读光标附近约 ${budget.toLocaleString("zh-CN")} 字；只改某一段：先选中它，再点上方的「问 AI」` : "评价、续写、润色。只改某一段：先选中它，再点上方的「问 AI」"}>
      {sectioned ? <SectionedScript value={value} onChange={v => { if (!locked) onChange(v); }} label={label} readOnly={locked} disabled={disabled}
        area={area} onOffset={s => { offset.current = s; setSel(null); }} onPaste={paste.onPaste} onTrack={track}/>
        : <textarea ref={area} className="director-script-text" aria-label={label} value={value} disabled={disabled} readOnly={locked}
          onChange={e => { if (!locked) onChange(e.target.value); track(); }} onPaste={paste.onPaste} onSelect={track} onKeyUp={track} onMouseUp={track} onBlur={() => setSel(null)}/>}
    </AiField>
    {paste.blocked && <LargePasteNotice chars={paste.blocked.chars} onClose={paste.clear} disabled={locked || disabled}
      onInsert={text => { const b = paste.blocked!; if (!locked) onChange(value.slice(0, b.start) + text + value.slice(b.end)); }}/>}
    <LongTextNote length={value.length} budget={budget}/>
  </div>;
}

/**
 * 正文比 AI 一次能读的长时，在正文下面说清 AI 怎么处理它：正文本身不限长、照常保存，
 * 但一次模型调用只读这么多（2026-10-29 取消字数上限时一起做的，不悄悄只读前半部）。
 */
export function LongTextNote({ length, budget }: { length: number; budget: number }) {
  if (!budget || length <= budget) return null;
  return <p className="director-long-note" role="note">
    正文 {length.toLocaleString("zh-CN")} 字，超过 AI 一次能读的约 {budget.toLocaleString("zh-CN")} 字。正文照常保存；助手读光标或选中处附近的一段，
    提取资产按集分批读，写分镜脚本要求每集在 {budget.toLocaleString("zh-CN")} 字以内（用「第1集」这样的标题分集可免费拆分）。
  </p>;
}

/** 预览修改时修改处前后各显示多少字。 */
const REVIEW_CONTEXT = 3000;

/** 正文处的对比：原文标红、建议标绿，采用只替换这一段，其余正文（包括你后来改的）不动。 */
function ScriptReview({ work, messageId, p, value, label }: { work: DirectorWork; messageId: string; p: DirectorProposal; value: string; label: string }) {
  const ctl = useAssistant()!;
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const mark = useRef<HTMLDivElement>(null);
  const range = proposalRange(value, p);
  useEffect(() => { mark.current?.scrollIntoView?.({ block: "center", behavior: "smooth" }); }, [range?.[0]]);
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(undefined); }
  };
  const impacts = proposalImpacts(work, p);
  return <div className="director-script-review" aria-label={`${label}：预览修改`}>
    <header><b>预览修改</b><span>{p.targetLabel} · 只替换这一段</span><span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" onClick={() => ctl.setPreview(null)}>返回编辑</button></header>
    {!range ? <div className="director-warn">原文已经改动，找不到这条建议要替换的段落。可以让助手按现在的正文重新给建议。</div> :
      <div className="director-script-review-body">
        {/* 长正文只画修改处前后各一截，不把几十万字一次画出来。 */}
        {range[0] > REVIEW_CONTEXT && <span className="director-muted">（前面还有 {(range[0] - REVIEW_CONTEXT).toLocaleString("zh-CN")} 字，未显示）{"\n"}</span>}
        <span className="director-script-plain">{value.slice(Math.max(0, range[0] - REVIEW_CONTEXT), range[0])}</span>
        <div ref={mark} className="director-script-change is-del"><em>原文</em><p>{value.slice(range[0], range[1])}</p></div>
        <div className="director-script-change is-add"><em>建议修改</em><p>{p.replacement || "（删掉这段）"}</p></div>
        <span className="director-script-plain">{value.slice(range[1], range[1] + REVIEW_CONTEXT)}</span>
        {value.length - range[1] > REVIEW_CONTEXT && <span className="director-muted">{"\n"}（后面还有 {(value.length - range[1] - REVIEW_CONTEXT).toLocaleString("zh-CN")} 字，未显示）</span>}
      </div>}
    {impacts.map(t => <p key={t} className="director-script-review-impact">{t}</p>)}
    {error && <p className="director-proposal-error" role="alert">{error}</p>}
    <footer>
      <small>只替换这一段，其余正文保留。采用后可以撤销。</small>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-button" disabled={!range || !!busy} onClick={() => void run("apply", () => ctl.act(messageId, p, "apply"))}>{busy === "apply" ? "采用中" : "采用这处修改"}</button>
      <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => void run("keep", () => ctl.act(messageId, p, "dismiss"))}>保留原文</button>
    </footer>
  </div>;
}
