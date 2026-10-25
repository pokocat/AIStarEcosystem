"use client";

import { SelectField } from "@ai-star-eco/ui/ui/select-field";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, FileText, Loader2, Pause, Play, Settings2, Shapes, Sparkles, Square, X } from "lucide-react";
import type { DirectorPipeline, DirectorPipelineEstimate, DirectorPipelineTarget, DirectorWork } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { DirectorApi } from "../api";
import { DirectorScript } from "./director-script";
import { DirectorAssets } from "./director-assets";
import { DirectorStoryboard } from "./director-storyboard";
import { ExtractReview } from "./director-extract";
import { InlineError, chooseDirectorBilling, costText, errorText, hasDrafts, secRange, useBusy, useEscape, dialogFocus } from "./director-shared";

export type Tab = "script" | "assets" | "storyboard";
const GO_LABEL: Record<Tab, string> = { script: "前往剧本", assets: "前往资产", storyboard: "前往分镜" };
export type WorkbenchProps = {
  work: DirectorWork;
  episodeId: string | null;
  apply: (next: DirectorWork) => void;
  setError: (message: string) => void;
  goTab: (tab: Tab) => void;
  /** 打开「确认资产」弹窗（有待保存的提取清单时）。 */
  reviewExtract: () => void;
  /** 打开顶栏的作品设置（风格、画幅、视频模型）。 */
  openSettings: () => void;
  /** 切换当前集（分镜页左侧分集栏）。 */
  pickEpisode: (id: string) => void;
  /** 打开「一键制作」弹窗。剧本页把它和「AI 拆分」并列放，说明它是快捷方式。 */
  startPipeline: () => void;
};

/** 下一步提示：按作品现状告诉用户该做什么，按钮直接带到对应位置。 */
function nextStep(work: DirectorWork, episodeId: string | null): { text: string; tab: Tab } | null {
  // AI 正在做的文字任务优先说出来：不然生成中还写着「下一步：生成剧本」，像是没开始。
  const running = work.tasks.filter(t => t.status === "running").map(t => t.target);
  if (running.includes("script")) return { text: "AI 正在写剧本，完成后自动显示", tab: "script" };
  if (running.includes("split")) return { text: "AI 正在拆分集", tab: "script" };
  if (running.some(t => t.startsWith("extract"))) return { text: "AI 正在提取全剧资产", tab: "script" };
  const planning = running.find(t => t.startsWith("plan:"));
  if (planning) { const ep = work.episodes.find(e => `plan:${e.id}` === planning); return { text: `AI 正在写${ep ? `第 ${ep.no} 集` : ""}分镜脚本`, tab: "storyboard" }; }
  if (!work.draft.trim() && work.episodes.length === 0) return { text: work.idea.trim() ? "下一步：确认创意，生成剧本" : "第一步：生成或粘贴剧本", tab: "script" };
  if (work.pendingSplit) return { text: `分成 ${work.pendingSplit.episodes.length} 集，确认后生效`, tab: "script" };
  if (work.episodes.length === 0) return { text: "下一步：拆分集，或直接作为一集", tab: "script" };
  const ep = work.episodes.find(e => e.id === episodeId) ?? work.episodes[0];
  if (!ep.extracted && !work.assets.some(a => a.episodeIds.includes(ep.id))) return { text: "下一步：提取全剧资产", tab: "script" };
  const clips = work.clips.filter(c => c.episodeId === ep.id);
  if (clips.length === 0) return { text: `下一步：写第 ${ep.no} 集分镜脚本`, tab: "storyboard" };
  const used = new Set(clips.flatMap(c => c.assetIds));
  const needImage = work.assets.filter(a => used.has(a.id) && !a.image.adoptedId);
  if (needImage.length) return { text: `缺少 ${needImage.length} 张参考图：${needImage.slice(0, 3).map(a => a.name).join("、")}`, tab: "assets" };
  const unconfirmed = work.assets.filter(a => used.has(a.id) && a.image.adoptedBy === "auto");
  if (unconfirmed.length) return { text: `${unconfirmed.length} 张参考图待确认`, tab: "assets" };
  const fix = clips.filter(c => c.issues.length);
  if (fix.length) return { text: `${fix.length} 个片段需修改后才能生成分镜图`, tab: "storyboard" };
  const noBoard = clips.filter(c => !c.board.adoptedId);
  if (noBoard.length) return { text: `下一步：生成 ${noBoard.length} 张分镜图`, tab: "storyboard" };
  const oldRefs = work.assets.filter(a => used.has(a.id) && a.image.adoptedCheck === "outdated");
  if (oldRefs.length) return { text: `${oldRefs.map(a => a.name).join("、")} 的参考图需更新`, tab: "assets" };
  const oldBoards = clips.filter(c => c.board.adoptedCheck === "outdated");
  if (oldBoards.length) return { text: `${oldBoards.map(c => `片段 ${c.order}`).join("、")} 的分镜图需更新`, tab: "storyboard" };
  const autoBoard = clips.filter(c => c.board.adoptedBy === "auto");
  if (autoBoard.length) return { text: `${autoBoard.length} 张分镜图待确认`, tab: "storyboard" };
  if (clips.some(c => c.video.pending?.length)) return { text: "片段视频生成中，完成后自动出现在片段卡", tab: "storyboard" };
  const noVideo = clips.filter(c => !c.video.adoptedId);
  if (noVideo.length) return { text: `下一步：生成 ${noVideo.length} 条片段视频`, tab: "storyboard" };
  const oldVideos = clips.filter(c => c.video.adoptedId && c.video.adoptedCheck === "outdated");
  if (oldVideos.length) return { text: `${oldVideos.map(c => `片段 ${c.order}`).join("、")} 的视频需更新`, tab: "storyboard" };
  const autoVideo = clips.filter(c => c.video.adoptedBy === "auto");
  if (autoVideo.length) return { text: `${autoVideo.length} 条片段视频待确认`, tab: "storyboard" };
  if (!(work.exports ?? []).some(e => e.episodeId === ep.id && e.status === "done")) return { text: `第 ${ep.no} 集视频已确认，可预览或导出`, tab: "storyboard" };
  return { text: `第 ${ep.no} 集已导出。更换片段视频后需重新导出`, tab: "storyboard" };
}

export function DirectorWorkbench({ id }: { id: string }) {
  const auth = useRequireAuth();
  const [work, setWork] = useState<DirectorWork>();
  const [loadError, setLoadError] = useState("");
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("script");
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const revision = useRef(0);
  const initialTab = useRef(false);
  const [reviewing, setReviewing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const reviewedRun = useRef<string | null>(null);

  const apply = useCallback((next: DirectorWork) => {
    if (next.revision < revision.current) return;
    revision.current = next.revision;
    setWork(next);
  }, []);

  const load = useCallback(async () => {
    try { apply(await DirectorApi.getWork(id)); setLoadError(""); }
    catch (e) { if (isProductNotEnrolledError(e)) setNotEnrolled(true); else setLoadError(errorText(e)); }
  }, [apply, id]);

  useEffect(() => { if (auth === "ok") void load(); }, [auth, load]);

  // 刷新、关页面时还有没保存的修改就提醒；站内切换工作区或集不会丢（见 useDraft）。
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (hasDrafts(`${id}:`)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [id]);

  // 有任务在跑或一键制作在进行时轮询；页面隐藏时不轮询，回来立刻刷新一次。
  const active = !!work && (work.tasks.some(t => t.status === "running"||t.status==="stopping") || work.pipeline?.status === "running");
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 2500);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [active, load]);

  useEffect(() => {
    if (!work) return;
    if (episodeId && !work.episodes.some(e => e.id === episodeId)) setEpisodeId(null);
    if (!episodeId && work.episodes.length) setEpisodeId(work.episodes[0].id);
    if (!initialTab.current) { initialTab.current = true; const step = nextStep(work, work.episodes[0]?.id ?? null); if (step) setTab(step.tab); }
  }, [work, episodeId]);

  // 提取结果一回来就弹出确认；关掉后这一份不再自动弹，可从状态线或资产页再打开。
  const pendingRun = work?.pendingExtract?.runId ?? null;
  useEffect(() => {
    if (pendingRun && pendingRun !== reviewedRun.current) { reviewedRun.current = pendingRun; setReviewing(true); }
    if (!pendingRun) setReviewing(false);
  }, [pendingRun]);

  if (auth === "no-platform" || notEnrolled) return <PlatformGateScreen/>;
  if (!work) return <main className="ip-brand-surface director-shell"><div className="director-loading">{loadError ? <><InlineError message={loadError}/><button className="ip-brand-secondary" onClick={() => void load()}>重新加载</button><Link href="/director">返回作品列表</Link></> : <><Loader2 size={22} className="ip-loading-icon"/>加载中…</>}</div></main>;

  // 换工作区时清掉上一处的报错：它说的是别处的事，留着会误导（2026-10-24 资产已入库，顶部还挂着「请先提取资产」）。
  const switchTab = (next: Tab) => { setTab(next); setError(""); };
  const props: WorkbenchProps = { work, episodeId, apply, setError, goTab: switchTab, reviewExtract: () => setReviewing(true), openSettings: () => { window.scrollTo({ top: 0, behavior: "smooth" }); setSettingsOpen(true); }, pickEpisode: setEpisodeId, startPipeline: () => setStarting(true) };
  const step = nextStep(work, episodeId);
  const counts = {
    assets: work.assets.filter(a => a.image.adoptedBy === "auto" || !a.image.adoptedId).length,
    storyboard: work.clips.filter(c => c.episodeId === episodeId && (c.issues.length || c.board.adoptedBy === "auto" || c.video.adoptedBy === "auto"
      || c.board.adoptedCheck === "outdated" || c.video.adoptedCheck === "outdated")).length,
  };
  const live = !!work.pipeline && ["running", "waiting", "paused"].includes(work.pipeline.status);
  return <main className="ip-brand-surface director-shell">
    <DirectorHeader {...props} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen}/>
    {/* 一条状态线：一键制作进行中就说它在做什么，否则说下一步该做什么。 */}
    {reviewing && work.pendingExtract && <ExtractReview key={work.pendingExtract.runId} work={work} apply={apply} onClose={() => setReviewing(false)}/>}
    {live ? <PipelineBar {...props}/> : <div className="director-status">
      {work.pendingExtract ? <div className="director-next is-warn"><Sparkles size={14}/><span>识别到 {work.pendingExtract.items.length} 项资产，确认后保存到资产库</span><button type="button" onClick={() => setReviewing(true)}>查看清单</button></div> :
        step && <div className="director-next"><Sparkles size={14}/><span title={step.text}>{step.text}</span>{step.tab !== tab && <button type="button" onClick={() => switchTab(step.tab)}>{GO_LABEL[step.tab] ?? "前往"}</button>}</div>}
      <PipelineBar {...props}/>
    </div>}
    {!live && <StopTextTasks {...props}/>}
    {starting && <StartPipeline work={work} episodeId={episodeId} apply={apply} setError={setError} onClose={() => setStarting(false)}/>}
    {work.notice && <div className="director-notice" role="status"><span>{work.notice.message}</span><button type="button" onClick={() => void DirectorApi.edit(work.id, "notice.dismiss", null, null).then(apply).catch(e => setError(errorText(e)))}>关闭</button></div>}
    <InlineError message={error} onClose={() => setError("")}/>
    <div className="director-body">
      <nav className="director-nav" role="tablist" aria-label="工作区" aria-orientation="vertical">
        {([["script", "剧本", FileText], ["assets", "资产", Shapes], ["storyboard", "分镜", Clapperboard]] as const).map(([key, label, Icon]) =>
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => switchTab(key)}>
            <Icon size={18}/><span>{label}</span>
            {key !== "script" && counts[key] > 0 && <small aria-label={`${counts[key]} 项待处理`}>{counts[key]}</small>}</button>)}
      </nav>
      <section className="director-main">
        {tab === "script" && <DirectorScript {...props}/>}
        {tab === "assets" && <DirectorAssets {...props}/>}
        {tab === "storyboard" && <DirectorStoryboard {...props}/>}
      </section>
    </div>
  </main>;
}

function StopTextTasks({work,apply,setError}:WorkbenchProps) {
  const {busy,run}=useBusy();
  const tasks=work.tasks.filter(task=>task.status==="running"&&task.canStop);
  const settling=work.tasks.some(task=>task.status==="stopping");
  if(!tasks.length&&!settling)return null;
  const label=(target:string)=>target==="script"?"写剧本":target==="split"?"拆分集":target.startsWith("extract")?"提取资产":target.startsWith("plan:")?"规划分镜":"本次创作";
  return <div className="director-notice"><span>{settling?"已停止后续处理，已提交模型的请求仍在等待用量结算。可另行确认生成，原请求按实际用量计费。":"停止后已有内容会保留；已提交模型的请求仍按实际用量计费。"}</span>
    {tasks.map(task=><button key={task.id} type="button" disabled={!!busy}
      onClick={()=>void run(task.id,async()=>apply(await DirectorApi.stopTask(work.id,task.id)),setError)}>
      {busy===task.id?"正在停止…":`停止${label(task.target)}`}</button>)}
  </div>;
}

function DirectorHeader({ work, apply, setError, settingsOpen: open, setSettingsOpen: setOpen }: WorkbenchProps & { settingsOpen: boolean; setSettingsOpen: (v: boolean | ((o: boolean) => boolean)) => void }) {
  const [title, setTitle] = useState(work.title);
  const { busy, run } = useBusy();
  useEffect(() => setTitle(work.title), [work.title]);
  const saveTitle = () => {
    const t = title.trim();
    if (!t || t === work.title) { setTitle(work.title); return; }
    void run("title", async () => apply(await DirectorApi.patchWork(work.id, { title: t })), setError);
  };
  const settings = work.settings;
  return <header className="director-header">
    <Link href="/director" className="director-back" aria-label="返回作品列表"><ArrowLeft size={18}/></Link>
    <input className="director-title" aria-label="作品名" value={title} maxLength={60} onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} disabled={busy === "title"}/>
    <span className="director-spacer"/>
    {work.pricing.mock && <span className="director-mock-tag" title="剧本、图片和视频均为固定样例，不调用模型，不扣积分。">测试模式</span>}
    <button type="button" className="director-settings-chip" onClick={() => setOpen(o => !o)} aria-expanded={open}>
      <Settings2 size={15}/>{settings.style} · {settings.aspectRatio}
    </button>
    {open && <SettingsPanel work={work} onClose={() => setOpen(false)} apply={apply} setError={setError}/>}
  </header>;
}

function SettingsPanel({ work, onClose, apply, setError }: { work: DirectorWork; onClose: () => void; apply: (w: DirectorWork) => void; setError: (m: string) => void }) {
  const [style, setStyle] = useState(work.settings.style);
  const [aspect, setAspect] = useState(work.settings.aspectRatio);
  const [videoModel, setVideoModel] = useState(work.settings.videoModel ?? "");
  const { busy, run } = useBusy();
  const save = () => void run("settings", async () => {
    apply(await DirectorApi.patchWork(work.id, { settings: { style: style.trim(), aspectRatio: aspect, videoModel: videoModel || null } }));
    onClose();
  }, setError);
  return <div className="director-popover" role="dialog" aria-label="作品设置" ref={dialogFocus} tabIndex={-1}>
    <header><h3>作品设置</h3><button type="button" aria-label="关闭" onClick={onClose}><X size={16}/></button></header>
    <label className="director-field"><span>画面风格</span><input value={style} maxLength={30} onChange={e => setStyle(e.target.value)}/></label>
    <div className="director-field"><span>画幅</span><div className="director-segmented">{(["9:16", "16:9", "1:1"] as const).map(a =>
      <button key={a} type="button" aria-pressed={aspect === a} onClick={() => setAspect(a)}>{a}</button>)}</div></div>
    <label className="director-field"><span>视频模型</span>
      <SelectField value={videoModel} onChange={e => setVideoModel(e.target.value)}>
        <option value="">默认{work.videoModels.find(m => m.isDefault) ? `（${work.videoModels.find(m => m.isDefault)!.name}）` : ""}</option>
        {work.videoModels.map(m => <option key={m.id} value={m.id}>{m.name} · {secRange(m.minSec, m.maxSec)}{m.mode === "frame" ? " · 仅分镜首帧" : ""}</option>)}
      </SelectField>
      <small>{!work.videoModels.length ? "暂无可用视频模型，无法确定片段时长。请联系管理员开通。"
        : work.videoModels.find(m => m.id === videoModel || (!videoModel && m.isDefault))?.mode === "frame"
          ? "仅使用分镜首帧，不支持额外图片或声音参考。多镜头片段请先拆分。"
          : "同时参考分镜图、角色 / 场景 / 道具图和角色声音。片段时长按模型支持的范围来定。"}</small>
    </label>
    <p className="director-dialog-note">修改仅影响之后生成的内容，已生成的内容不变。</p>
    <footer><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button><button type="button" className="ip-brand-button" disabled={busy === "settings"} onClick={save}>保存</button></footer>
  </div>;
}

// ── 一键制作 ────────────────────────────────────────────────────────────────

const TARGETS: Array<{ key: DirectorPipelineTarget; label: string; note: string }> = [
  { key: "film", label: "成片", note: "从剧本一路做到每集的成片：拆分集、提取资产、写分镜脚本、出参考图和分镜图、生成片段视频，最后导出整集。" },
  { key: "board", label: "分镜图", note: "做到参考图和分镜图为止，不生成视频。" },
  { key: "plan", label: "分镜脚本", note: "只做文字：拆分集、提取资产、写分镜脚本（每段的镜头、分镜图提示词和视频提示词），不出图。" },
];

function PipelineBar({ work, apply, setError, goTab, reviewExtract, startPipeline }: WorkbenchProps) {
  const p = work.pipeline;
  const { busy, run } = useBusy();
  const act = (action: "pause" | "resume" | "retry" | "confirm-assets" | "confirm-boards" | "confirm-videos" | "stop" | "dismiss", budget?: number) =>
    void run(action, async () => apply(await DirectorApi.pipeline(work.id, { action, budget })), setError);
  const live = p && ["running", "waiting", "paused"].includes(p.status);
  return <>
    <div className={`director-pipeline ${p ? `is-${p.status}` : ""}`}>
      {!live && <>
        {p && <span className="director-pipeline-hint"><PipelineSummary p={p}/></span>}
        {p && <button type="button" className="ip-brand-text-button" onClick={() => act("dismiss")}>收起</button>}
        <button type="button" className="ip-brand-secondary director-oneclick" title="快捷方式：从剧本一路自动做到成片（也可以只做到分镜脚本或分镜图），后台执行，关掉页面不中断。想逐步检查每一步，就按剧本页的步骤来。" onClick={startPipeline}><Sparkles size={15}/>一键制作<em className="director-shortcut-tag">快捷</em></button>
      </>}
      {live && p && <>
        <PipelineSummary p={p}/>
        <div className="director-pipeline-actions">
          {p.stage === "confirm-split" && p.status === "waiting" && <button type="button" className="ip-brand-button" onClick={() => goTab("script")}>查看分集</button>}
          {p.stage === "confirm-extract" && p.status === "waiting" && <button type="button" className="ip-brand-button" onClick={reviewExtract}>查看清单</button>}
          {p.stage === "confirm-assets" && p.status === "waiting" && <><button type="button" className="ip-brand-secondary" onClick={() => goTab("assets")}>查看参考图</button>
            <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => act("confirm-assets")}>全部确认并继续</button></>}
          {p.stage === "confirm-boards" && p.status === "waiting" && <><button type="button" className="ip-brand-secondary" onClick={() => goTab("storyboard")}>查看分镜图</button>
            <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => act("confirm-boards")}>全部确认并继续</button></>}
          {p.stage === "confirm-videos" && p.status === "waiting" && <><button type="button" className="ip-brand-secondary" onClick={() => goTab("storyboard")}>查看片段视频</button>
            <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => act("confirm-videos")}>全部确认并导出</button></>}
          {p.stage === "fix-clips" && p.status === "waiting" && <><button type="button" className="ip-brand-secondary" onClick={() => goTab("storyboard")}>前往修改</button>
            <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => act("resume")}>继续</button></>}
          {p.stage === "failed-items" && p.status === "waiting" && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => act("retry")}>重试失败项</button>}
          {p.stage === "budget" && p.status === "waiting" && <BudgetRaise p={p} onResume={b => act("resume", b)} disabled={!!busy}/>}
          {p.stage === "blocked" && p.status === "waiting" && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => act("resume")}>继续</button>}
          {p.status === "running" && <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => act("pause")}><Pause size={14}/>暂停</button>}
          {p.status === "paused" && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => act("resume")}><Play size={14}/>继续</button>}
          <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => act("stop")}><Square size={13}/>停止</button>
        </div>
      </>}
    </div>
  </>;
}

function PipelineSummary({ p }: { p: DirectorPipeline }) {
  const label = { running: "制作中", waiting: "待处理", paused: "已暂停", done: "已完成", failed: "未完成", stopped: "已停止" }[p.status];
  return <span className="director-pipeline-summary">
    {p.status === "running" && <Loader2 size={14} className="ip-loading-icon"/>}
    <b>{label}</b><span>{p.message}</span><small>已用 {p.spent.toLocaleString("zh-CN")} / 预算 {p.budget.toLocaleString("zh-CN")} 积分</small>
  </span>;
}

function BudgetRaise({ p, onResume, disabled }: { p: DirectorPipeline; onResume: (budget: number) => void; disabled: boolean }) {
  const [value, setValue] = useState(String(Math.max(p.budget * 2, p.budget + 100)));
  const n = Number(value);
  return <span className="director-budget"><label>预算上限<input inputMode="numeric" value={value} onChange={e => setValue(e.target.value.replace(/\D/g, ""))}/>积分</label>
    <button type="button" className="ip-brand-button" disabled={disabled || !(n > p.budget)} onClick={() => onResume(n)}>提高预算并继续</button></span>;
}

function StartPipeline({ work, episodeId, apply, setError, onClose }: { work: DirectorWork; episodeId: string | null; apply: (w: DirectorWork) => void; setError: (m: string) => void; onClose: () => void }) {
  const multi = work.episodes.length > 1;
  const [scope, setScope] = useState<"episode" | "work">("work");
  const [target, setTarget] = useState<DirectorPipelineTarget>("film");
  const [auto, setAuto] = useState(true);
  const [est, setEst] = useState<DirectorPipelineEstimate | null>(null);
  const [estError, setEstError] = useState("");
  const [custom, setCustom] = useState<string | null>(null);
  const [error, setLocalError] = useState("");
  const { busy, run } = useBusy();
  useEscape(() => { if (!busy) onClose(); });
  const ep = work.episodes.find(e => e.id === episodeId) ?? work.episodes[0];
  const effectiveScope = multi ? scope : "work";
  // 推荐预算由服务端按真实单价算；换目标或范围就重新算。
  useEffect(() => {
    let live = true;
    setEst(null); setEstError("");
    DirectorApi.estimatePipeline(work.id, { scope: effectiveScope, episodeId: effectiveScope === "episode" ? ep?.id ?? null : null, target })
      .then(r => { if (live) setEst(r); }).catch(e => { if (live) setEstError(errorText(e)); });
    return () => { live = false; };
  }, [work.id, effectiveScope, ep?.id, target]);
  const budget = custom !== null ? Number(custom) : est?.recommended ?? 0;
  const tooLow = !!est && custom !== null && budget < est.total;
  const start = () => void run("start", async () => {
    const billing = await chooseDirectorBilling("script", budget);
    apply(await DirectorApi.pipeline(work.id, { action: "start", scope: effectiveScope, episodeId: effectiveScope === "episode" ? ep?.id ?? null : null, target, budget, billing, auto }));
    onClose();
  }, setLocalError);
  const note = TARGETS.find(t => t.key === target)!.note;
  const mock = work.pricing.mock;
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-dialog director-start-dialog" role="dialog" aria-modal="true" aria-labelledby="director-start-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-start-title">一键制作</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18}/></button></header>
      <p className="director-shortcut-note">这是快捷方式，后面几步会连着自动做完。想每一步先看再改，就关掉这个窗口，在剧本页按步骤来。</p>
      <div className="director-field"><span>做到哪一步</span><div className="director-segmented">
        {TARGETS.map(t => <button key={t.key} type="button" aria-pressed={target === t.key} onClick={() => { setTarget(t.key); setCustom(null); }}>{t.label}</button>)}</div>
        <small>{note}已经做好的不重做，已有内容不覆盖。</small></div>
      {multi && <div className="director-field"><span>范围</span><div className="director-segmented">
        <button type="button" aria-pressed={scope === "work"} onClick={() => { setScope("work"); setCustom(null); }}>全部 {work.episodes.length} 集</button>
        <button type="button" aria-pressed={scope === "episode"} onClick={() => { setScope("episode"); setCustom(null); }}>只做第 {ep?.no} 集</button></div></div>}
      {target !== "plan" && <label className="director-check">
        <input type="checkbox" checked={!auto} onChange={e => setAuto(!e.target.checked)}/>
        <span><b>关键步骤停下来让我确认</b><small>资产清单、参考图、分镜图{target === "film" ? "、片段视频" : ""}出来后先等你看过再继续。不勾就全自动，做完再看。</small></span>
      </label>}
      <section className="director-budget-card" aria-label="预算">
        <header><span>推荐预算</span>{est && <b>{mock ? "测试模式，免费" : `${est.recommended.toLocaleString("zh-CN")} 积分`}</b>}{!est && !estError && <Loader2 size={15} className="ip-loading-icon"/>}</header>
        {estError && <InlineError message={estError}/>}
        {est && <>
          <ul>
            <li><span>文字生成 {est.text.count} 次</span><em>{costText(est.text.credits, mock)}</em></li>
            {target !== "plan" && <li><span>图片 {est.images.count} 张</span><em>{costText(est.images.credits, mock)}</em></li>}
            {est.videos.included && <li><span>片段视频 {est.videos.clips} 段，约 {est.videos.seconds} 秒</span><em>{est.videos.error ? "暂时无法估算" : costText(est.videos.credits, mock)}</em></li>}
          </ul>
          <small>{est.rough ? "还没规划的部分按默认篇幅估算（每集约 75 秒）。" : ""}推荐值比估算多留约 15% 余量；用到上限会暂停，不会超支，没用完的不扣。{est.videos.error ? ` 视频：${est.videos.error}` : ""}</small>
          {custom === null ? <button type="button" className="ip-brand-text-button director-self-start" onClick={() => setCustom(String(est.recommended))}>调整预算</button> :
            <label className="director-field"><span>预算上限（积分）</span><input inputMode="numeric" value={custom} autoFocus onChange={e => setCustom(e.target.value.replace(/\D/g, ""))}/>
              {tooLow && <small className="director-cost is-error">低于估算的 {est.total.toLocaleString("zh-CN")} 积分，做到一半会暂停。</small>}</label>}
        </>}
      </section>
      <InlineError message={error}/>
      <footer><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy || !est || !(budget > 0)} onClick={start}>
          {busy ? <><Loader2 size={15} className="ip-loading-icon"/>启动中</> : custom === null ? "按推荐预算开始" : "开始"}</button></footer>
    </div>
  </div>;
}
