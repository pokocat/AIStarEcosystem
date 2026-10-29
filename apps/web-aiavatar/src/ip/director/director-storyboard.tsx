"use client";

import { SelectField } from "@ai-star-eco/ui/ui/select-field";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, FileText, Lightbulb, Clapperboard, Film, ImageIcon, LayoutGrid, Loader2, Play, Plus, RefreshCw, Scissors, Trash2, Wand2, X } from "lucide-react";
import type { DirectorClip, DirectorShot, DirectorTask, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { useStudioApp } from "../studio-errors";
import type { WorkbenchProps } from "./director-workbench";
import { AiWorking, InlineError, OutdatedNote, Spinner, VersionStrip, adopted, chooseDirectorBilling, clearDrafts, costText, errorText, failed, hasDrafts, kindLabel, newRequestId, runningTask, secRange, useBusy, useDraft, useEscape, DirectorSheet, dialogFocus, ZoomableImage, type DirectorFail } from "./director-shared";
import { ClipVideo, EpisodeOutput, type ClipQuote } from "./director-output";
import { RewriteEpisodeDialog, clipRewriteBlock, shotWriting, useRewriteClip } from "./director-rewrite";
import { formatDateTime } from "@/lib/datetime";
import { AskAI, useAssistant } from "./director-assistant";
import { StoryboardSide } from "./director-script-reference";

export function DirectorStoryboard(props: WorkbenchProps) {
  const { work, episodeId, apply, setError, goTab, pickEpisode, focus } = props;
  const { modal } = useStudioApp();
  const { busy, run } = useBusy();
  const ep = work.episodes.find(e => e.id === episodeId);
  // 视频报价：只给分镜图已确认、没在生成的片段报价；作品内容变了就重新报。
  const ready = work.clips.filter(c => c.episodeId === episodeId && c.board.adoptedBy === "user" && !c.video.pending?.length).map(c => c.id).join(",");
  const [quotes, setQuotes] = useState<Record<string, ClipQuote>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [boardFor, setBoardFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rewriting, setRewriting] = useState(false);
  const rewriteClip = useRewriteClip(work, apply, setError);
  useEffect(() => setSelected(new Set()), [episodeId]);
  // 从资产页或错误弹窗「前往」某个片段：滚到它，打开它的关联资产（高亮那项）或镜头编辑。
  useEffect(() => {
    if (!focus) return;
    const target = work.clips.find(c => c.id === focus.clipId);
    if (!target || target.episodeId !== episodeId) return;
    window.requestAnimationFrame(() => document.getElementById(`clip-${target.id}`)?.scrollIntoView?.({ block: "center", behavior: "smooth" }));
    if (focus.open === "assets") setPreview({ clipId: target.id, kind: "assets", assetId: focus.assetId });
  }, [focus?.at, episodeId]); // eslint-disable-line react-hooks/exhaustive-deps
  // 剧本预览里正在对照的片段；换集清掉。
  const [focusClipId, setFocusClipId] = useState<string | null>(null);
  const [scriptSheet, setScriptSheet] = useState(false);
  useEffect(() => setFocusClipId(null), [episodeId]);
  // 助手卡片上的「查看版本」：打开那个片段的分镜图弹窗。
  const assistant = useAssistant();
  const reveal = assistant?.reveal;
  useEffect(() => { if (reveal?.type === "board" && work.clips.some(c => c.id === reveal.id)) setBoardFor(reveal.id); }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) { setQuotes({}); return; }
    let live = true;
    void DirectorApi.quote(work.id, ready.split(",")).then(q => { if (live) setQuotes(Object.fromEntries(q.items.map(i => [i.targetId, { credits: i.credits, error: i.error }]))); })
      .catch(() => { /* 报价失败时按钮点下去会再报一次价，并显示原因 */ });
    return () => { live = false; };
  }, [work.id, work.revision, ready]);
  if (!ep) return <div className="director-panel director-empty-panel"><p>请先在「剧本」完成剧本并拆分集。</p></div>;
  const clips = work.clips.filter(c => c.episodeId === ep.id).sort((a, b) => a.order - b.order);
  const writing = shotWriting(work, ep);
  const lim = work.videoLimits;
  const hasMedia = clips.some(c => c.board.candidates.length || c.video.candidates.length);
  // 第一次写分镜脚本：本集还没有片段，直接写。已有片段时走「重写分镜脚本」弹窗，先说清会改什么。
  const plan = () => void run("plan", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("storyboard");
    apply(await DirectorApi.runTask(work.id, { type: "plan", targetId: ep.id, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, failed(setError, `写第 ${ep.no} 集分镜脚本`));
  const rewriteBlock = !lim ? "暂无可用视频模型，无法确定片段时长" : writing.clips.length
    ? `${clips.filter(c => runningTask(work, `reshoot:${c.id}`)).map(c => `片段 ${c.order}`).join("、")} 正在重写，完成后再重写整集` : "";
  const openRewrite = () => rewriteBlock ? modal.info({ title: `现在不能重写第 ${ep.no} 集`, content: rewriteBlock, okText: "知道了" }) : setRewriting(true);
  const pending = ep.pendingPlan;
  const previewClip = preview ? work.clips.find(c => c.id === preview.clipId) : undefined;
  const boardClip = boardFor ? work.clips.find(c => c.id === boardFor) : undefined;
  return <div className="director-board-layout">
    <StoryboardSide work={work} ep={ep} focusClipId={focusClipId} sheetOpen={scriptSheet} setSheetOpen={setScriptSheet}
      episodes={<EpisodeSidebar work={work} episodeId={ep.id} onPick={pickEpisode}/>}/>
    <div className="director-storyboard">
      <div className="director-toolbar">
        <div className="director-toolbar-copy"><h3 title={ep.title}>第 {ep.no} 集 · {ep.title}</h3>
          <p>{clips.length ? `${clips.length} 个片段，共 ${clips.reduce((s, c) => s + c.durationSec, 0)} 秒` : "暂无片段"}
            {lim ? ` · 每段 ${secRange(lim.minSec, lim.maxSec)} · ${lim.name}` : <span id="director-plan-block"> · 暂无可用视频模型，无法确定片段时长</span>}
            {lim?.mode === "frame" && <span className="director-frame-note" title="仅使用分镜首帧，不支持额外图片或声音参考。多镜头片段请先拆分。"> · 仅分镜首帧</span>}</p></div>
        <span className="director-spacer"/>
        {writing.plan || writing.whole ? <Spinner label={writing.plan ? "正在写分镜脚本" : "正在重写分镜脚本"}/>
          : clips.length ? <button type="button" className="ip-brand-secondary" disabled={!!busy} title="AI 重写本集的镜头，分镜图和视频提示词跟着更新；不出图、不生成视频" onClick={openRewrite}>
            <RefreshCw size={14}/>重写分镜脚本</button>
          : <button type="button" className="ip-brand-button" disabled={!!busy} aria-describedby={lim ? undefined : "director-plan-block"}
            onClick={() => lim ? plan() : modal.info({ title: `现在不能写第 ${ep.no} 集分镜脚本`, content: "片段时长要按视频模型来定，目前没有可用的视频模型。可以先去「资产」准备参考图，有可用模型后再写分镜脚本。", okText: "知道了" })}>
            <LayoutGrid size={15}/>写分镜脚本</button>}
        {clips.length > 0 && <AskAI scope={{ kind: "storyboard", episodeId: ep.id }} label="和助手讨论本集分镜" title="结合本集剧本和全部片段讨论；助手只会改你指定的片段和镜头"/>}
        <EpisodeOutput work={work} ep={ep} apply={apply} setError={setError}/>
      </div>
      {writing.plan && <AiWorking compact title={`AI 正在写第 ${ep.no} 集分镜脚本`} task={writing.plan} detail="把本集正文切成视频片段，写好每个镜头，以及每段的分镜图提示词和视频提示词。"/>}
      {writing.whole && <AiWorking compact title={`AI 正在重写第 ${ep.no} 集分镜脚本`} task={writing.whole} detail="片段划分不变，逐段换一套新镜头，分镜图提示词和视频提示词跟着更新。不会出图，也不会生成视频。"/>}
      {ep.planError && <InlineError message={ep.planError.message}/>}
      {ep.planStale && <div className="director-warn">分镜脚本写好后正文又改过，片段可能和正文对不上。</div>}
      {pending && <div className="director-warn"><span>写分镜脚本期间你改过片段，新写的版本（{pending.clips.length} 个片段）没有覆盖现有内容。要换成新版本吗？</span>
        <button type="button" disabled={!!busy || hasMedia} title={hasMedia ? "请先删除已有分镜图的片段" : undefined} onClick={() => void run("pending", async () => apply(await DirectorApi.edit(work.id, "episode.usePendingPlan", ep.id, null)), failed(setError, "换成新写的分镜脚本"))}>换成新版本</button>
        <button type="button" disabled={!!busy} onClick={() => void run("discard", async () => apply(await DirectorApi.edit(work.id, "episode.discardPendingPlan", ep.id, null)), failed(setError, "保留现有分镜脚本"))}>保留现有</button></div>}
      {clips.length === 0 && !writing.plan && <div className="director-panel director-empty-panel">
        <Clapperboard size={26}/>
        <p>分镜脚本把本集切成几个片段，每段写好镜头、分镜图提示词和视频提示词，一段对应一条视频。写之前先在「资产」准备好角色、场景和道具。</p>
        {work.assets.length === 0 && <button type="button" className="ip-brand-secondary" onClick={() => goTab("assets")}>前往资产</button>}
      </div>}
      {clips.length > 0 && <BatchBar work={work} clips={clips} quotes={quotes} selected={selected} setSelected={setSelected} apply={apply} setError={setError}/>}
      {clips.map(c => <ClipCard key={c.id} {...props} clip={c} quote={quotes[c.id]} onPreview={(kind, candidateId) => setPreview({ clipId: c.id, kind, candidateId })} onBoard={() => setBoardFor(c.id)} editorAt={focus?.open === "editor" && focus.clipId === c.id ? focus.at : undefined}
        onRewrite={() => rewriteClip.open(c)} rewriteTask={runningTask(work, `reshoot:${c.id}`) ?? writing.whole}
        focused={focusClipId === c.id} onFocusScript={() => { setFocusClipId(c.id); setScriptSheet(document.documentElement.dataset.layout !== "desktop"); }}
        selected={selected.has(c.id)} onSelect={on => setSelected(prev => { const next = new Set(prev); if (on) next.add(c.id); else next.delete(c.id); return next; })}/>)}
    </div>
    {preview && previewClip && <ClipPreview work={work} clip={previewClip} preview={preview} apply={apply} setError={setError} goTab={goTab}
      onPick={candidateId => setPreview({ ...preview, candidateId })} onClose={() => setPreview(null)}/>}
    {boardClip && <BoardDialog work={work} clip={boardClip} apply={apply} setError={setError} onClose={() => setBoardFor(null)}/>}
    {rewriting && <RewriteEpisodeDialog work={work} ep={ep} apply={apply} onClose={() => setRewriting(false)}/>}
  </div>;
}

/** 多选片段后一键生成分镜图或视频：先列出哪些能做、哪些跳过及原因、一共多少积分，确认后依次提交，付款方只选一次。 */
function BatchBar({ work, clips, quotes, selected, setSelected, apply, setError }: { work: DirectorWork; clips: DirectorClip[]; quotes: Record<string, ClipQuote>; selected: Set<string>; setSelected: (s: Set<string>) => void; apply: (w: DirectorWork) => void; setError: DirectorFail }) {
  const { modal } = useStudioApp();
  const { busy, run } = useBusy();
  const chosen = clips.filter(c => selected.has(c.id));
  const all = chosen.length === clips.length;
  const plan = (kind: "board" | "video") => {
    const ok: { clip: DirectorClip; cost: number }[] = [];
    const skipped: string[] = [];
    for (const c of chosen) {
      const reason = kind === "board" ? (runningTask(work, `board:${c.id}`) ? "分镜图生成中" : boardBlockReason(work, c)) : videoBlockReason(work, c, quotes[c.id]);
      if (reason) skipped.push(`片段 ${c.order}：${reason}`);
      else ok.push({ clip: c, cost: kind === "board" ? work.pricing.image : quotes[c.id]!.credits! });
    }
    return { ok, skipped, total: ok.reduce((n, x) => n + x.cost, 0) };
  };
  const start = (kind: "board" | "video") => {
    const p = plan(kind);
    const what = kind === "board" ? "分镜图" : "视频";
    (p.ok.length ? modal.confirm : modal.info)({
      title: p.ok.length ? `为 ${p.ok.length} 个片段生成${what}？` : `选中的片段都不能生成${what}`,
      content: <div className="director-batch-confirm">
        {p.ok.length > 0 && <p>{p.ok.map(x => `片段 ${x.clip.order}`).join("、")} · {costText(p.total, work.pricing.mock)}{kind === "board" && p.ok.some(x => x.clip.board.candidates.length) ? "。已有分镜图的会生成新版本，原版本保留。" : ""}</p>}
        {p.skipped.length > 0 && <><p className="director-muted">跳过 {p.skipped.length} 个（不扣积分）：</p><ul>{p.skipped.map(t => <li key={t}>{t}</li>)}</ul></>}
      </div>,
      okText: p.ok.length ? "开始生成" : "知道了", cancelText: "取消",
      onOk: () => { if (!p.ok.length) return; return run(kind, async () => {
        const billing = await chooseDirectorBilling(kind === "board" ? "image" : "video", p.total);
        const failures: string[] = [];
        for (const x of p.ok) {
          try { apply(await DirectorApi.runTask(work.id, { type: kind, targetId: x.clip.id, clientRequestId: newRequestId(), billing, maxCost: x.cost })); }
          catch (e) { failures.push(`片段 ${x.clip.order}：${errorText(e)}`); }
        }
        if (failures.length) setError({ action: `批量生成${what}`, error: `${p.ok.length} 个片段里有 ${failures.length} 个没有提交成功：${failures.join("；")}`,
          next: "其余的已经开始生成。没提交成功的，按上面的原因处理后在那个片段上单独生成。" });
        setSelected(new Set());
      }, failed(setError, `批量生成${what}`)); },
    });
  };
  return <div className="director-batch">
    <label className="director-batch-all"><input type="checkbox" checked={all} ref={el => { if (el) el.indeterminate = chosen.length > 0 && !all; }}
      onChange={e => setSelected(e.target.checked ? new Set(clips.map(c => c.id)) : new Set())}/>全选</label>
    <span className="director-muted">已选择 {chosen.length} 个片段</span>
    <span className="director-spacer"/>
    <button type="button" className="ip-brand-secondary" disabled={!chosen.length || !!busy} onClick={() => start("board")}><LayoutGrid size={14}/>批量生成分镜图</button>
    <button type="button" className="ip-brand-button" disabled={!chosen.length || !!busy} onClick={() => start("video")}><Film size={14}/>批量生成视频</button>
  </div>;
}

/** 分集放左侧一列：集多也好找，每集带进度，点一下切换。 */
function EpisodeSidebar({ work, episodeId, onPick }: { work: DirectorWork; episodeId: string; onPick: (id: string) => void }) {
  return <nav className="director-episode-side" aria-label="分集">
    <h4>分集<small>{work.episodes.length}</small></h4>
    <ol>{work.episodes.map(e => {
      const clips = work.clips.filter(c => c.episodeId === e.id);
      const videos = clips.filter(c => c.video.adoptedId).length;
      const done = clips.length > 0 && videos === clips.length;
      return <li key={e.id}><button type="button" aria-current={e.id === episodeId ? "true" : undefined} onClick={() => onPick(e.id)} title={`第 ${e.no} 集 · ${e.title}`}>
        <b>第 {e.no} 集</b><span>{e.title}</span>
        <small className={done ? "is-done" : undefined}>{clips.length ? `视频 ${videos}/${clips.length}` : "待写分镜"}</small>
      </button></li>;
    })}</ol>
  </nav>;
}

type PreviewKind = "assets" | "video";
type Preview = { clipId: string; kind: PreviewKind; candidateId?: string; /** 从资产页跳来时要处理的那项资产 */ assetId?: string };

function clipStatus(work: DirectorWork, clip: DirectorClip) {
  if (runningTask(work, `reshoot:${clip.id}`) || runningTask(work, `reshoot:${clip.episodeId}`)) return "分镜脚本重写中";
  if (runningTask(work, `board:${clip.id}`)) return "分镜图生成中";
  if (clip.video.pending?.length) return "视频生成中";
  if (clip.issues.length) return "需修改";
  if (!clip.board.adoptedId) return "待生成分镜图";
  if (clip.board.adoptedCheck === "outdated") return "分镜图需更新";
  if (clip.board.adoptedBy === "auto") return "分镜图待确认";
  if (!clip.video.adoptedId) return "待生成视频";
  if (clip.video.adoptedCheck === "outdated") return "视频需更新";
  if (clip.video.adoptedBy === "auto") return "视频待确认";
  return "视频已确认";
}

/** 这个片段现在能不能生成分镜图：有问题、缺参考图、参考图没确认都不能。卡片、弹窗、批量共用这一条。 */
function boardBlockReason(work: DirectorWork, clip: DirectorClip) {
  const visual = (clip.assetIds.map(id => work.assets.find(a => a.id === id)).filter(Boolean) as DirectorWork["assets"]).filter(a => !a.description.includes("只出声音"));
  const missing = visual.filter(a => !a.image.adoptedId);
  const unconfirmed = visual.filter(a => a.image.adoptedBy === "auto");
  if (clip.issues.length) return "片段有待处理的问题";
  if (missing.length) return `缺少参考图：${missing.map(a => a.name).join("、")}`;
  if (unconfirmed.length) return `参考图待确认：${unconfirmed.map(a => a.name).join("、")}`;
  return "";
}

/** 这个片段现在能不能生成视频（报价另算）：分镜图要确认，不能正在生成，首帧模型绑了声音要先选「不带声音参考」。 */
function videoBlockReason(work: DirectorWork, clip: DirectorClip, quote?: ClipQuote) {
  if (clip.video.pending?.length || runningTask(work, `video:${clip.id}`)) return "视频生成中";
  if (!clip.board.adoptedId) return "还没有分镜图";
  if (clip.board.adoptedBy !== "user") return "分镜图待确认";
  if (work.videoLimits?.mode === "frame" && (clip.voiced?.length ?? 0) > 0 && !clip.videoWithoutVoice) return "需先选择不带声音参考";
  if (quote?.error) return quote.error;
  if (quote?.credits == null) return "报价中";
  return "";
}

function slotStatus(slot: DirectorClip["board"], busy: boolean) {
  if (busy) return "生成中";
  if (!slot.adoptedId) return "未生成";
  if (slot.adoptedCheck === "outdated") return "需更新";
  return slot.adoptedBy === "auto" ? "待确认" : "已确认";
}

function tone(status: string) {
  return status === "已确认" ? "is-done" : status === "待确认" || status === "需更新" ? "is-warn" : "";
}

function ClipHead({ work, clip, apply, setError, onEdit, selected, onSelect, onRewrite, rewriteBlock, rewriting, onFocusScript, focused }: { work: DirectorWork; clip: DirectorClip; apply: (w: DirectorWork) => void; setError: DirectorFail; onEdit: (() => void) | null; selected?: boolean; onSelect?: (on: boolean) => void;
  onRewrite?: () => void; rewriteBlock?: string; rewriting?: boolean; onFocusScript?: () => void; focused?: boolean }) {
  const { modal } = useStudioApp();
  const { run } = useBusy();
  // 不能重写时也能点：点了说原因，不做一个点了没反应的灰按钮。
  const rewrite = () => rewriteBlock ? modal.info({ title: `现在不能重写片段 ${clip.order}`, content: rewriteBlock, okText: "知道了" }) : onRewrite?.();
  const remove = () => modal.confirm({ title: `删除片段 ${clip.order}？`, content: "片段内的镜头和分镜图将一并移除。", okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
    onOk: () => run("delete", async () => apply(await DirectorApi.edit(work.id, "clip.delete", clip.id, null)), failed(setError, `删除片段 ${clip.order}`)) });
  return <header className="director-clip-head">
    {onSelect && <input type="checkbox" className="director-clip-check" aria-label={`选择片段 ${clip.order}`} checked={!!selected} onChange={e => onSelect(e.target.checked)}/>}
    <span className="director-clip-no">{clip.order}</span>
    <div><h4 title={clip.title}>{clip.title || `片段 ${clip.order}`}</h4><p>{clip.durationSec} 秒 · {clip.shots.length} 镜 · {clipStatus(work, clip)}</p></div>
    <span className="director-spacer"/>
    {onFocusScript && <button type="button" className="ip-brand-text-button" aria-pressed={focused} onClick={onFocusScript} title="在剧本预览里标出这个片段对应的正文"><FileText size={13}/>对照剧本</button>}
    <AskAI scope={{ kind: "clip", clipId: clip.id }} label="AI 改镜头" title="结合本集剧本讨论或调整这个片段的镜头：景别、机位、动作、台词、时长"/>
    {rewriting ? <Spinner label="重写中"/> : onRewrite && <button type="button" className="ip-brand-text-button" title="AI 重写这一段的镜头和提示词，不出图、不生成视频" onClick={rewrite}><RefreshCw size={13}/>重写</button>}
    {onEdit && <button type="button" className="ip-brand-text-button" onClick={onEdit}>编辑镜头</button>}
    <button type="button" className="ip-brand-text-button director-danger" aria-label="删除片段" onClick={remove}><Trash2 size={14}/></button>
  </header>;
}

/**
 * 一个片段一张卡，主体是视频：分镜图是生成视频的参考（不是资产），单独一个入口、单独一个弹窗；
 * 视频提示词按分镜图第 1–N 格逐镜写，宫格保证前后镜头的人物、环境一致。
 */
function ClipCard({ work, clip, quote, apply, setError, onPreview, onBoard, selected, onSelect, onRewrite, rewriteTask, editorAt, focused, onFocusScript }: WorkbenchProps & { clip: DirectorClip; quote?: ClipQuote; onPreview: (kind: PreviewKind, candidateId?: string) => void; onBoard: () => void; selected: boolean; onSelect: (on: boolean) => void;
  onRewrite: () => void; rewriteTask?: DirectorTask; editorAt?: number; focused: boolean; onFocusScript: () => void }) {
  // 没保存的镜头修改切走再回来还在，编辑区保持打开。
  const [editing, setEditing] = useState(() => hasDrafts(`${work.id}:clip:${clip.id}:edit:`));
  // 从资产页「前往」来改台词说话人：直接打开镜头编辑。
  useEffect(() => { if (editorAt && !rewriteTask) setEditing(true); }, [editorAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const { busy: pendingBusy, run: runPending } = useBusy();
  const pendingShots = clip.pendingShots;
  const board = adopted(clip.board);
  const generating = runningTask(work, `board:${clip.id}`);
  const videoBusy = !!clip.video.pending?.length || !!runningTask(work, `video:${clip.id}`);
  const linked = clip.assetIds.map(id => work.assets.find(a => a.id === id)).filter(Boolean) as DirectorWork["assets"];
  const visual = linked.filter(a => !a.description.includes("只出声音"));
  const missing = visual.filter(a => !a.image.adoptedId);
  const unconfirmed = visual.filter(a => a.image.adoptedBy === "auto");
  const boardStatus = slotStatus(clip.board, !!generating);
  const assetIssue = missing.length ? `缺 ${missing.length} 张参考图` : unconfirmed.length ? `${unconfirmed.length} 张待确认` : "";
  const grid = clip.shots.length > 1;
  const boardReady = !!clip.board.adoptedId && clip.board.adoptedBy === "user";
  const ratio = `ratio-${work.settings.aspectRatio.replace(":", "x")}`;
  const shownVideo = adopted(clip.video) ?? clip.video.candidates[clip.video.candidates.length - 1];
  const videoTag = shownVideo ? (shownVideo.id === clip.video.adoptedId ? (clip.video.adoptedBy === "auto" ? "待确认" : clip.video.adoptedCheck === "outdated" ? "需更新" : "采用中") : "未采用")
    : videoBusy ? "视频生成中" : null;
  return <article id={`clip-${clip.id}`} className={`director-clip-card ${clip.issues.length ? "has-issues" : ""} ${focused ? "is-focused" : ""}`}>
    <ClipHead work={work} clip={clip} apply={apply} setError={setError} onEdit={editing || rewriteTask ? null : () => setEditing(true)} selected={selected} onSelect={onSelect}
      onRewrite={onRewrite} rewriteBlock={clipRewriteBlock(work, clip, editing)} rewriting={!!rewriteTask} onFocusScript={onFocusScript} focused={focused}/>
    {rewriteTask && rewriteTask.target === `reshoot:${clip.id}` && <AiWorking compact title={`AI 正在重写片段 ${clip.order} 的分镜脚本`} task={rewriteTask} detail="写好后这一段的镜头、分镜图提示词和视频提示词自动更新。不会出图，也不会生成视频。"/>}
    {pendingShots && <div className="director-warn"><span>重写期间你改过这一段，新写的版本（{pendingShots.shots.length} 个镜头）没有覆盖现有内容。要换成新版本吗？</span>
      <button type="button" disabled={!!pendingBusy} onClick={() => void runPending("use", async () => apply(await DirectorApi.edit(work.id, "clip.usePendingShots", clip.id, null)), failed(setError, `把片段 ${clip.order} 换成新写的版本`))}>换成新版本</button>
      <button type="button" disabled={!!pendingBusy} onClick={() => void runPending("discard", async () => apply(await DirectorApi.edit(work.id, "clip.discardPendingShots", clip.id, null)), failed(setError, `保留片段 ${clip.order} 的现有版本`))}>保留现有</button></div>}
    {editing ? <>
      {clip.summary && <p className="director-clip-summary">{clip.summary}</p>}
      <ClipEditor work={work} clip={clip} apply={apply} setError={setError} onDone={() => setEditing(false)}/>
    </> : <div className={`director-clip-body ${ratio}`}>
      {/* 左：成片画面（有视频看视频，没有就看分镜图），下面是生成视频用到的两样参考。 */}
      <aside className="director-clip-media">
        <button type="button" className={`director-clip-stage ${ratio}`} onClick={() => shownVideo ? onPreview("video", shownVideo.id) : onBoard()}
          aria-label={shownVideo ? `播放片段 ${clip.order} 的视频` : `查看片段 ${clip.order} 的分镜图`}>
          {board?.url ? <img src={board.url} alt=""/> : <span className="director-clip-stage-empty"><LayoutGrid size={18}/>{generating ? "分镜图生成中" : "还没有分镜图"}</span>}
          {shownVideo && <i className="director-clip-play"><Play size={20}/></i>}
          {(generating || videoBusy) && <span className="director-clip-stage-busy"><Loader2 size={16} className="ip-loading-icon"/></span>}
          <span className={`director-clip-stage-tag ${videoTag === "待确认" || videoTag === "需更新" ? "is-warn" : ""}`}>{videoTag ?? (board ? "分镜图 · 还没有视频" : "未生成")}</span>
        </button>
        {clip.video.candidates.length > 1 && <div className="director-clip-versions" role="group" aria-label="视频版本">
          {clip.video.candidates.map((m, i) => <button key={m.id} type="button" aria-pressed={m.id === clip.video.adoptedId} onClick={() => onPreview("video", m.id)}
            title={m.stale ? "生成期间设置有变动，此版本需更新" : m.id === clip.video.adoptedId ? "采用中" : `第 ${i + 1} 版`}>{i + 1}{m.stale ? "·旧" : ""}</button>)}
        </div>}
        <div className="director-clip-links" role="group" aria-label="生成视频用到的参考">
          <button type="button" onClick={() => onPreview("assets")} className={missing.length ? "is-error" : unconfirmed.length ? "is-warn" : ""} title="角色、场景、道具的标准照，用来锁定长相和环境">
            <span className="director-avatar-stack">{linked.slice(0, 3).map(a => { const img = adopted(a.image); return img?.url ? <img key={a.id} src={img.url} alt=""/> : <i key={a.id}>{a.name.slice(0, 1)}</i>; })}</span>
            <span>关联资产 <b>{linked.length}</b></span>{assetIssue && <small>{assetIssue}</small>}</button>
          <button type="button" onClick={onBoard} className={`director-board-link ${boardStatus === "待确认" || boardStatus === "需更新" ? "is-warn" : ""}`} title="视频按这张分镜图逐格生成，保证前后镜头一致">
            <LayoutGrid size={14}/><span>分镜图</span>
            <small className={tone(boardStatus)}>{grid ? `${Math.min(clip.shots.length, 4)} 格 · ` : ""}{boardStatus === "未生成" ? "点击生成" : boardStatus}{clip.board.candidates.length > 1 ? ` · ${clip.board.candidates.length} 版` : ""}</small></button>
        </div>
      </aside>
      {/* 右：说明、提示、视频提示词，最后一行是生成设置和操作。 */}
      <div className="director-clip-main">
        {clip.summary && <p className="director-clip-summary">{clip.summary}</p>}
        {clip.issues.length > 0 && <div className="director-issues" role="alert"><AlertTriangle size={15}/><ul>{clip.issues.map(i => <li key={i}>{i}</li>)}</ul></div>}
        {clip.issues.length === 0 && (clip.warnings?.length ?? 0) > 0 && <div className="director-shot-hints" role="note">
          <Lightbulb size={14}/><div><b>镜头节奏建议</b><ul>{clip.warnings!.map(i => <li key={i}>{i}</li>)}</ul>
            <small>不影响生成。要调整就点「编辑镜头」，或重写本集分镜脚本。</small></div></div>}
        <section className="director-video-section" aria-label="视频">
          <header><b>视频提示词</b><span>{grid ? `按分镜图第 1–${Math.min(clip.shots.length, 4)} 格逐镜生成` : "以分镜画面为构图参考"}{work.videoLimits?.mode === "frame" ? "，只用分镜首帧" : "，图1 是分镜图，图2 起是关联资产"}</span>
            <AskAI scope={{ kind: "prompt", clipId: clip.id, which: "video" }} label="和助手讨论" title="结合剧本、镜头和实际参考素材改写视频提示词；只改提示词，不改剧情"/></header>
          <PromptEditor work={work} clip={clip} which="video" apply={apply} setError={setError}/>
        </section>
        <ClipVideo work={work} clip={clip} quote={quote} apply={apply} setError={setError} onBoard={boardReady || videoBusy ? undefined : onBoard}
          settings={`${work.settings.style} · ${work.settings.aspectRatio} · ${clip.durationSec} 秒 · ${work.videoLimits?.name ?? "视频模型未开通"}`}/>
      </div>
    </div>}
  </article>;
}

/** 分镜图单独一个弹窗：大图、历史版本、分镜图提示词，确认或提交重新生成。 */
function BoardDialog({ work, clip, apply, setError, onClose }: { work: DirectorWork; clip: DirectorClip; apply: (w: DirectorWork) => void; setError: DirectorFail; onClose: () => void }) {
  const [viewId, setViewId] = useState<string | null>(clip.board.adoptedId ?? clip.board.candidates[clip.board.candidates.length - 1]?.id ?? null);
  const prefix = `${work.id}:clip:${clip.id}:prompt:board`;
  const [text, setText, dirty] = useDraft(prefix, clip.boardPrompt);
  const [localError, setLocalError] = useState("");
  const { busy, run } = useBusy();
  useEscape(() => { if (!busy) onClose(); });
  const generating = runningTask(work, `board:${clip.id}`);
  const shown = clip.board.candidates.find(m => m.id === viewId) ?? adopted(clip.board);
  const blockReason = boardBlockReason(work, clip);
  const ratio = `ratio-${work.settings.aspectRatio.replace(":", "x")}`;
  const cells = Math.min(clip.shots.length, 4);
  const assistant = useAssistant();
  const askAbout = (scope: Parameters<NonNullable<typeof assistant>["ask"]>[0]) => { assistant?.ask(scope); onClose(); };
  const regenerate = () => void run("board", async () => {
    let w = work;
    if (dirty) { w = await DirectorApi.edit(work.id, "clip.update", clip.id, clip.rev, { boardPrompt: text }); clearDrafts(prefix); apply(w); }
    const cost = work.pricing.image;
    const billing = await chooseDirectorBilling("image", cost);
    apply(await DirectorApi.runTask(work.id, { type: "board", targetId: clip.id, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, setLocalError);
  const adopt = (id: string) => void run("adopt", async () => apply(await DirectorApi.edit(work.id, "clip.adoptBoard", clip.id, null, { candidateId: id })), setLocalError);
  const confirm = () => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "clip.confirmBoard", clip.id, null)), setLocalError);
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog director-board-dialog" role="dialog" aria-modal="true" aria-labelledby="director-board-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-board-title">分镜图 · 片段 {clip.order}</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={!!busy}><X size={18}/></button></header>
      <p className="director-dialog-note">{cells > 1 ? `2×2 宫格，第 1–${cells} 格依次对应第 1–${cells} 镜。生成视频时按格逐镜参考，保证前后镜头的人物和环境一致。` : "单幅分镜画面，生成视频时作为构图参考。"}</p>
      <div className="director-board-dialog-body">
        <div className={`director-board-big ${ratio}`}>
          {shown?.url ? <ZoomableImage src={shown.url} alt={`片段 ${clip.order} 的分镜图`}/> : <span>{generating ? "生成中…" : "还没有分镜图"}</span>}
          {generating && <div className="director-board-busy"><Spinner label="生成中"/></div>}
          {shown && shown.id === clip.board.adoptedId && <span className={`director-tag-inline ${clip.board.adoptedBy === "auto" ? "is-warn" : ""}`}>{clip.board.adoptedBy === "auto" ? "采用中 · 待确认" : "采用中"}</span>}
        </div>
        <aside className="director-board-history">
          <h3>历史版本<small>{clip.board.candidates.length}</small></h3>
          {clip.board.candidates.length === 0 ? <p className="director-muted">生成后出现在这里。</p> :
            <ul>{[...clip.board.candidates].reverse().map((m, i, arr) => <li key={m.id}>
              <button type="button" aria-pressed={m.id === shown?.id} className={ratio} onClick={() => setViewId(m.id)} title={m.stale ? "生成期间设置有变动，此版本需更新" : undefined}>
                {m.url ? <img src={m.url} alt=""/> : null}
                <small>第 {arr.length - i} 版{m.id === clip.board.adoptedId ? " · 采用中" : ""}{m.stale ? " · 需更新" : ""}</small>
              </button>
            </li>)}</ul>}
          {shown && shown.id !== clip.board.adoptedId && <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => adopt(shown.id)}>采用这一版</button>}
          {assistant && clip.board.adoptedId && <button type="button" className="director-ask-ai" onClick={() => askAbout({ kind: "image", clipId: clip.id, which: "board" })}
            title="说说这张哪里要改（如「第三格改近景，其他保持一致」），助手改提示词；生成新版本另外确认费用"><Wand2 size={13}/>围绕这张图修改</button>}
        </aside>
      </div>
      <OutdatedNote slot={clip.board} what="张分镜图"/>
      {assistant && <button type="button" className="director-ask-ai director-self-start" onClick={() => askAbout({ kind: "prompt", clipId: clip.id, which: "board" })}><Wand2 size={13}/>让 AI 改分镜图提示词</button>}
      <label className="director-field"><span>分镜图提示词 <em>不要改宫格数量、景别和镜头顺序；要改镜头请关掉后点「编辑镜头」</em></span>
        <textarea className="director-prompt" rows={6} maxLength={7000} value={text} onChange={e => setText(e.target.value)}/></label>
      <div className="director-actions">
        {dirty && <><span className="director-unsaved">未保存</span><button type="button" className="ip-brand-text-button" onClick={() => setText(clip.boardPrompt)}>撤销修改</button></>}
        {clip.boardPromptCustom && !dirty && <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => void run("reset", async () => apply(await DirectorApi.edit(work.id, "clip.update", clip.id, clip.rev, { resetBoardPrompt: true })), setLocalError)}><RefreshCw size={13}/>恢复自动生成</button>}
      </div>
      <InlineError message={localError || clip.board.error?.message}/>
      <footer>
        <small className="director-cost">{blockReason || (work.pricing.mock ? costText(0, true) : `每张${costText(work.pricing.image, false)}`)}</small>
        <span className="director-spacer"/>
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>关闭</button>
        {clip.board.adoptedBy === "auto" && <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={confirm}><Check size={14}/>确认使用</button>}
        <button type="button" className="ip-brand-button" disabled={!!busy || !!generating || !!blockReason} onClick={regenerate}>
          <Wand2 size={14}/>{generating ? "生成中" : clip.board.candidates.length ? (dirty ? "保存并重新生成" : "提交重新生成") : (dirty ? "保存并生成" : "生成分镜图")}</button>
      </footer>
    </div>
  </div>;
}

/** 右侧抽屉：关联资产（锁定长相和环境的标准照）或视频结果，就地查看，不离开分镜页。 */
function ClipPreview({ work, clip, preview, apply, setError, goTab, onPick, onClose }: { work: DirectorWork; clip: DirectorClip; preview: Preview; apply: (w: DirectorWork) => void; setError: DirectorFail; goTab: WorkbenchProps["goTab"]; onPick: (candidateId: string) => void; onClose: () => void }) {
  const { busy, run } = useBusy();
  const { modal } = useStudioApp();
  // 解除关联：只从这个片段的关联资产里去掉这一项。先把真实影响说清楚（已有分镜图 / 视频、台词说话人、手改的提示词）。
  const unlink = (a: DirectorWork["assets"][number]) => {
    const lines = clip.shots.reduce((n, s) => n + s.dialogue.filter(l => l.speakerId === a.id).length, 0);
    const made = [clip.board.candidates.length ? "分镜图" : "", clip.video.candidates.length ? "视频" : ""].filter(Boolean).join("和");
    modal.confirm({
      title: `从片段 ${clip.order} 解除「${a.name}」的关联？`,
      content: <ul className="director-regen-notes">
        <li>只把「{a.name}」从片段 {clip.order} 的关联资产里去掉：不删除片段，不删除资产，其他片段不受影响。</li>
        <li>之后这一段出分镜图和视频不再参考「{a.name}」的参考图，提示词随之更新。</li>
        {made && <li className="is-warn">这一段已有的{made}不会删除；和新的关联对不上的会标成「需更新」，要不要重新生成由你决定。</li>}
        {lines > 0 && <li className="is-warn">「{a.name}」在这一段还有 {lines} 句台词，台词和说话人不变。要删除这个角色，还要在「编辑镜头」里把这些台词换成别的说话人。</li>}
        {(clip.boardPromptCustom || clip.videoPromptCustom) && <li className="is-warn">这一段手改过的提示词不会自动更新，写到「{a.name}」的地方需要自己改。</li>}
      </ul>,
      okText: "解除关联", okButtonProps: { danger: true }, cancelText: "取消",
      onOk: () => run(`unlink:${a.id}`, async () => apply(await DirectorApi.edit(work.id, "clip.unlinkAsset", clip.id, null, { assetId: a.id })),
        failed(setError, `解除「${a.name}」与片段 ${clip.order} 的关联`)),
    });
  };
  const target = preview.assetId ? work.assets.find(a => a.id === preview.assetId) : undefined;
  const targetGone = !!target && !clip.assetIds.includes(target.id);
  const linked = clip.assetIds.map(id => work.assets.find(a => a.id === id)).filter(Boolean) as DirectorWork["assets"];
  const ratio = `ratio-${work.settings.aspectRatio.replace(":", "x")}`;
  const media = clip.video.candidates.find(m => m.id === preview.candidateId) ?? adopted(clip.video);
  return <DirectorSheet onClose={onClose} label={preview.kind === "assets" ? "关联资产" : "视频"}>
    <div className="director-preview">
      <header><span className="director-clip-no">{clip.order}</span><h3 title={clip.title}>{preview.kind === "assets" ? "关联资产" : "视频"} · {clip.title || `片段 ${clip.order}`}</h3></header>
      {preview.kind === "assets" ? <>
        <p className="director-dialog-note">角色、场景、道具的标准照，只用来锁定长相、服装和环境；镜头构图看分镜图。</p>
        {targetGone && <div className="director-notice director-unlinked-note" role="status"><span>「{target!.name}」已不在这个片段的关联资产里。{
          work.clips.some(c => c.assetIds.includes(target!.id)) ? "其他片段还在用它，回到资产页可以看是哪些。" : "没有片段在用它了，回到资产页就可以删除。"}</span>
          <button type="button" onClick={() => { onClose(); goTab("assets"); }}>回到资产页</button></div>}
        {linked.length === 0 ? <p className="director-muted">这个片段还没有关联资产，可在卡片上点「编辑镜头」调整。</p> :
          <ul className="director-preview-assets">{linked.map(a => {
            const img = adopted(a.image);
            const audioOnly = a.description.includes("只出声音");
            const status = audioOnly ? "仅声音出场" : !a.image.adoptedId ? "缺少参考图" : a.image.adoptedBy === "auto" ? "待确认" : a.image.adoptedCheck === "outdated" ? "需更新" : "已确认";
            return <li key={a.id} className={a.id === preview.assetId ? "is-focused" : undefined}>
              <span className="director-preview-asset-img">{img?.url ? <img src={img.url} alt={a.name}/> : <ImageIcon size={18}/>}</span>
              <div><b>{a.name}<small>{kindLabel[a.kind]}</small></b>
                <small className={status === "已确认" ? "is-done" : status === "缺少参考图" ? "is-error" : "is-warn"}>{status}{a.voice ? " · 已绑定声音" : ""}</small>
                <p title={a.description}>{a.description || "暂无描述"}</p>
                <button type="button" className="ip-brand-text-button director-danger director-unlink" disabled={!!busy} onClick={() => unlink(a)}
                  aria-label={`从片段 ${clip.order} 解除${a.name}的关联`}>{busy === `unlink:${a.id}` ? "正在解除…" : "解除关联"}</button></div>
            </li>;
          })}</ul>}
        <button type="button" className="ip-brand-secondary" onClick={() => { onClose(); goTab("assets"); }}>去资产页修改</button>
      </> : <>
        <div className={`director-preview-stage ${ratio}`}>
          {media?.url ? <video key={media.id} src={media.url} controls autoPlay preload="metadata" playsInline/> : <span>还没有视频</span>}
          {media && media.id === clip.video.adoptedId && <span className={`director-tag-inline ${clip.video.adoptedBy === "auto" ? "is-warn" : ""}`}>{clip.video.adoptedBy === "auto" ? "采用中 · 待确认" : "采用中"}</span>}
        </div>
        {clip.video.candidates.length > 1 && <div className="director-preview-versions">{clip.video.candidates.map((m, i) =>
          <button key={m.id} type="button" aria-pressed={m.id === media?.id} onClick={() => onPick(m.id)}>视频 {i + 1}{m.id === clip.video.adoptedId ? " · 采用中" : ""}</button>)}</div>}
        <div className="director-card-actions">
          {media && media.id !== clip.video.adoptedId && <button type="button" className="ip-brand-secondary" disabled={!!busy}
            onClick={() => void run("adopt", async () => apply(await DirectorApi.edit(work.id, "clip.adoptVideo", clip.id, null, { candidateId: media.id })), failed(setError, `采用片段 ${clip.order} 的这版视频`))}>采用这一版</button>}
          {media && media.id === clip.video.adoptedId && clip.video.adoptedBy === "auto" && <button type="button" className="ip-brand-button" disabled={!!busy}
            onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "clip.confirmVideo", clip.id, null)), failed(setError, `确认片段 ${clip.order} 的视频`))}><Check size={14}/>确认使用</button>}
        </div>
        {media?.refs && media.refs.length > 0 && <p className="director-used-refs">参考：{media.refs.map(r => `${r.label} ${r.name}`).join("、")}</p>}
      </>}
    </div>
  </DirectorSheet>;
}

/** 一份提示词（视频或分镜图），保存、恢复自动生成各自独立。 */
function PromptEditor({ work, clip, which, apply, setError }: { work: DirectorWork; clip: DirectorClip; which: "board" | "video"; apply: (w: DirectorWork) => void; setError: DirectorFail }) {
  const prefix = `${work.id}:clip:${clip.id}:prompt:`;
  const server = which === "board" ? clip.boardPrompt : clip.videoPrompt;
  const custom = which === "board" ? clip.boardPromptCustom : clip.videoPromptCustom;
  const [text, setText, dirty] = useDraft(prefix + which, server);
  const { busy, run } = useBusy();
  const save = (data: object) => void run("prompt", async () => {
    const next = await DirectorApi.edit(work.id, "clip.update", clip.id, clip.rev, data);
    clearDrafts(prefix + which); apply(next);
  }, failed(setError, `保存片段 ${clip.order} 的${which === "board" ? "分镜图" : "视频"}提示词`, "改过的内容还在输入框里，按原因调整后再点「保存」。"));
  const frame = work.videoLimits?.mode === "frame";
  return <div className="director-prompts">
    <textarea className="director-prompt" rows={5} aria-label={which === "board" ? "分镜图提示词" : "视频提示词"} maxLength={7000} value={text} onChange={e => setText(e.target.value)}/>
    <div className="director-actions">
      <button type="button" className="ip-brand-secondary" disabled={!!busy || !dirty} onClick={() => save(which === "board" ? { boardPrompt: text } : { videoPrompt: text })}>保存</button>
      {dirty && <span className="director-unsaved">未保存</span>}
      {custom && <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => save(which === "board" ? { resetBoardPrompt: true } : { resetVideoPrompt: true })}><RefreshCw size={13}/>恢复自动生成</button>}
      <span className="director-spacer"/>
      <small className="director-muted">{custom ? (which === "board" ? "已自定义，镜头修改不再同步" : "已自定义") : "随镜头自动生成"}</small>
    </div>
    {which === "video" && <SentPrompt clip={clip}/>}
  </div>;
}

/** H3 实际收到的是按官方写法改写的英文稿：备好了就能展开看；还没有就说明生成时会先改写。 */
function SentPrompt({ clip }: { clip: DirectorClip }) {
  if (!clip.videoPromptRewrite || clip.videoPromptRewrite === "off") return null;
  if (clip.videoPromptRewrite === "original")
    return <p className="director-sent-prompt-note">这一段选了按原文生成，中文提示词直接发给视频模型。</p>;
  if (clip.videoPromptRewrite === "needed" || !clip.videoPromptEn?.text)
    return <p className="director-sent-prompt-note">生成视频时，会先把这段提示词改写成 H3 官方要求的英文格式（台词保留中文原文），改写会额外消耗少量积分。</p>;
  return <details className="director-sent-prompt">
    <summary>发给模型的英文（{formatDateTime(clip.videoPromptEn.at)} 改写）</summary>
    <pre>{clip.videoPromptEn.text}</pre>
  </details>;
}

type ShotDraft = Omit<DirectorShot, "startSec" | "endSec"> & { durationText: string };

function ClipEditor({ work, clip, apply, setError, onDone }: { work: DirectorWork; clip: DirectorClip; apply: (w: DirectorWork) => void; setError: DirectorFail; onDone: () => void }) {
  const prefix = `${work.id}:clip:${clip.id}:edit:`;
  const [title, setTitle] = useDraft(prefix + "title", clip.title);
  const [summary, setSummary] = useDraft(prefix + "summary", clip.summary);
  const [assetIds, setAssetIds] = useDraft(prefix + "assets", clip.assetIds);
  const [shots, setShots] = useDraft<ShotDraft[]>(prefix + "shots", clip.shots.map(s => ({ ...s, durationText: String(s.durationSec) })));
  const cancel = () => { clearDrafts(prefix); onDone(); };
  const [localError, setLocalError] = useState("");
  const { busy, run } = useBusy();
  const characters = work.assets.filter(a => a.kind === "character");
  const total = shots.reduce((s, x) => s + (Number(x.durationText) || 0), 0);
  const lim = work.videoLimits;
  const update = (i: number, patch: Partial<ShotDraft>) => setShots(shots.map((s, j) => j === i ? { ...s, ...patch } : s));
  const unknownIds = assetIds.filter(id => !work.assets.some(a => a.id === id));
  const save = () => {
    if (shots.some(s => !(Number(s.durationText) > 0))) { setLocalError("镜头时长须大于 0 秒"); return; }
    void run("save", async () => {
      const next = await DirectorApi.edit(work.id, "clip.update", clip.id, clip.rev, {
        title, summary, assetIds,
        shots: shots.map(({ durationText, ...s }) => ({ ...s, durationSec: Number(durationText) })),
      });
      clearDrafts(prefix); apply(next);
      onDone();
    }, setLocalError);
  };
  const split = (at: number) => void run("split", async () => { const next = await DirectorApi.edit(work.id, "clip.split", clip.id, clip.rev, { atShot: at }); clearDrafts(prefix); apply(next); onDone(); }, setLocalError);
  return <div className="director-clip-editor">
    <div className="director-two">
      <label className="director-field"><span>片段标题</span><input value={title} maxLength={40} onChange={e => setTitle(e.target.value)}/></label>
      <label className="director-field"><span>剧情摘要</span><input value={summary} maxLength={1000} onChange={e => setSummary(e.target.value)}/></label>
    </div>
    <div className="director-field"><span>关联资产（生成分镜图时使用其已采用的参考图）</span>
      <div className="director-asset-picks">{work.assets.map(a => <label key={a.id}><input type="checkbox" checked={assetIds.includes(a.id)}
        onChange={e => setAssetIds(e.target.checked ? [...assetIds, a.id] : assetIds.filter(x => x !== a.id))}/>{kindLabel[a.kind]} · {a.name}</label>)}
        {unknownIds.map(id => <label key={id} className="is-missing"><input type="checkbox" checked onChange={() => setAssetIds(assetIds.filter(x => x !== id))}/>资产「{id}」不存在（取消勾选以移除）</label>)}
      </div></div>
    <ol className="director-shot-editor">{shots.map((s, i) => <li key={s.id}>
      <div className="director-shot-editor-head"><b>镜头 {i + 1}</b>
        <label>时长<input inputMode="decimal" value={s.durationText} onChange={e => update(i, { durationText: e.target.value.replace(/[^\d.]/g, "") })}/>秒</label>
        <label>景别<input value={s.size} maxLength={40} onChange={e => update(i, { size: e.target.value })}/></label>
        <span className="director-spacer"/>
        {i > 0 && <button type="button" className="ip-brand-text-button" disabled={!!busy} title="从此镜头起拆为新片段（未保存的修改将丢弃）" onClick={() => split(i)}><Scissors size={13}/>拆分</button>}
        <button type="button" className="ip-brand-text-button director-danger" aria-label={`删除镜头 ${i + 1}`} onClick={() => setShots(shots.filter((_, j) => j !== i))}><X size={14}/></button>
      </div>
      <label className="director-field"><span>分镜画面</span><textarea rows={2} maxLength={1000} value={s.still} onChange={e => update(i, { still: e.target.value })}/></label>
      <label className="director-field"><span>动作（起始 → 过程 → 结束）</span><textarea rows={2} maxLength={1000} value={s.action} onChange={e => update(i, { action: e.target.value })}/></label>
      <label className="director-field"><span>机位与构图</span><input value={s.camera} maxLength={1000} onChange={e => update(i, { camera: e.target.value })}/></label>
      {s.dialogue.map((l, j) => <div key={j} className="director-line-editor">
        <SelectField aria-label="说话人" value={l.speakerId ?? ""} onChange={e => update(i, { dialogue: s.dialogue.map((x, k) => k === j ? { ...x, speakerId: e.target.value || null } : x) })}>
          <option value="">旁白 / 画外音</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          {l.speakerId && !characters.some(c => c.id === l.speakerId) && <option value={l.speakerId}>未知角色（{l.speakerId}）</option>}
        </SelectField>
        <input aria-label="台词" value={l.text} maxLength={1000} onChange={e => update(i, { dialogue: s.dialogue.map((x, k) => k === j ? { ...x, text: e.target.value } : x) })}/>
        <button type="button" className="ip-brand-text-button" aria-label="删除台词" onClick={() => update(i, { dialogue: s.dialogue.filter((_, k) => k !== j) })}><X size={13}/></button>
      </div>)}
      <button type="button" className="ip-brand-text-button" onClick={() => update(i, { dialogue: [...s.dialogue, { speakerId: characters[0]?.id ?? null, text: "" }] })}><Plus size={13}/>添加台词</button>
    </li>)}</ol>
    <div className="director-actions">
      <button type="button" className="ip-brand-secondary" onClick={() => setShots([...shots, { id: `new-${Date.now()}`, durationSec: 3, durationText: "3", size: "中景", camera: "", action: "", still: "", dialogue: [] }])}><Plus size={14}/>添加镜头</button>
      <span className={`director-cost ${lim && (total < lim.minSec || total > lim.maxSec || shots.length > lim.maxShots) ? "is-error" : ""}`}>共 {Math.round(total * 10) / 10} 秒 · {shots.length} 镜{lim ? `（模型支持 ${secRange(lim.minSec, lim.maxSec)}，最多 ${lim.maxShots} 镜）` : ""}</span>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={cancel}>取消</button>
      <button type="button" className="ip-brand-button" disabled={!!busy} onClick={save}>保存</button>
    </div>
    <InlineError message={localError} onClose={() => setLocalError("")}/>
  </div>;
}
