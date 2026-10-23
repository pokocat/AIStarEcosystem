"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Clapperboard, LayoutGrid, Plus, RefreshCw, Scissors, Trash2, Wand2, X } from "lucide-react";
import type { DirectorClip, DirectorShot, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { useStudioApp } from "../studio-errors";
import type { WorkbenchProps } from "./director-workbench";
import { InlineError, OutdatedNote, Spinner, VersionStrip, adopted, chooseDirectorBilling, clearDrafts, costText, hasDrafts, kindLabel, newRequestId, runningTask, secRange, useBusy, useDraft } from "./director-shared";
import { ClipVideo, EpisodeOutput, type ClipQuote } from "./director-output";

const CELLS = ["左上", "右上", "左下", "右下"];

export function DirectorStoryboard(props: WorkbenchProps) {
  const { work, episodeId, apply, setError, goTab } = props;
  const { modal } = useStudioApp();
  const { busy, run } = useBusy();
  const ep = work.episodes.find(e => e.id === episodeId);
  // 视频报价：只给分镜图已确认、没在生成的片段报价；作品内容变了就重新报。
  const ready = work.clips.filter(c => c.episodeId === episodeId && c.board.adoptedBy === "user" && !c.video.pending?.length).map(c => c.id).join(",");
  const [quotes, setQuotes] = useState<Record<string, ClipQuote>>({});
  useEffect(() => {
    if (!ready) { setQuotes({}); return; }
    let live = true;
    void DirectorApi.quote(work.id, ready.split(",")).then(q => { if (live) setQuotes(Object.fromEntries(q.items.map(i => [i.targetId, { credits: i.credits, error: i.error }]))); })
      .catch(() => { /* 报价失败时按钮点下去会再报一次价，并显示原因 */ });
    return () => { live = false; };
  }, [work.id, work.revision, ready]);
  if (!ep) return <div className="director-panel director-empty-panel"><p>请先在「剧本」完成剧本并拆分集。</p></div>;
  const clips = work.clips.filter(c => c.episodeId === ep.id).sort((a, b) => a.order - b.order);
  const planning = runningTask(work, `plan:${ep.id}`);
  const hasMedia = clips.some(c => c.board.candidates.length || c.video.candidates.length);
  const plan = () => {
    const go = () => run("plan", async () => {
      const cost = work.pricing.textMax;
      const billing = await chooseDirectorBilling("storyboard", cost);
      apply(await DirectorApi.runTask(work.id, { type: "plan", targetId: ep.id, clientRequestId: newRequestId(), billing, maxCost: cost }));
    }, setError);
    if (clips.length) modal.confirm({ title: `重新规划第 ${ep.no} 集？`, content: "现有片段和镜头（含手动修改）将被新规划替换。", okText: "重新规划", cancelText: "取消", onOk: go });
    else void go();
  };
  const pending = ep.pendingPlan;
  const lim = work.videoLimits;
  return <div className="director-storyboard">
    <div className="director-toolbar">
      <div className="director-toolbar-copy"><h3>第 {ep.no} 集 · {ep.title}</h3>
        <p>{clips.length ? `${clips.length} 个片段，共 ${clips.reduce((s, c) => s + c.durationSec, 0)} 秒` : "暂无片段"}
          {lim ? ` · 每段 ${secRange(lim.minSec, lim.maxSec)}（${lim.name}）` : " · 暂无可用视频模型，无法确定片段时长"}</p>
        {lim?.mode === "frame" && <p className="director-frame-note">仅使用分镜首帧，不支持额外图片或声音参考。多镜头片段请先拆分。</p>}</div>
      <span className="director-spacer"/>
      {planning ? <Spinner label="片段规划中"/> : <>
        <button type="button" className={clips.length ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy || hasMedia || !lim} title={hasMedia ? "请先删除已有分镜图的片段" : undefined} onClick={plan}>
          <LayoutGrid size={15}/>{clips.length ? "重新规划" : "规划片段"}</button>
        <span className="director-cost">{costText(work.pricing.textMax, work.pricing.mock)}</span>
      </>}
    </div>
    {ep.planError && <InlineError message={ep.planError.message}/>}
    {ep.planStale && <div className="director-warn">正文在规划后有修改，片段可能与正文不一致。</div>}
    {pending && <div className="director-warn"><span>规划期间片段有修改，新规划（{pending.clips.length} 个片段）未覆盖现有内容。是否替换？</span>
      <button type="button" disabled={!!busy || hasMedia} title={hasMedia ? "请先删除已有分镜图的片段" : undefined} onClick={() => void run("pending", async () => apply(await DirectorApi.edit(work.id, "episode.usePendingPlan", ep.id, null)), setError)}>替换为新规划</button>
      <button type="button" disabled={!!busy} onClick={() => void run("discard", async () => apply(await DirectorApi.edit(work.id, "episode.discardPendingPlan", ep.id, null)), setError)}>保留现有</button></div>}
    {clips.length === 0 && !planning && <div className="director-panel director-empty-panel">
      <Clapperboard size={26}/>
      <p>将本集拆分为若干片段，每个片段生成一条视频。规划前请先在「资产」准备角色、场景和道具。</p>
      {work.assets.length === 0 && <button type="button" className="ip-brand-secondary" onClick={() => goTab("assets")}>前往资产</button>}
    </div>}
    <EpisodeOutput work={work} ep={ep} apply={apply} setError={setError}/>
    {clips.map(c => <ClipCard key={c.id} {...props} clip={c} quote={quotes[c.id]}/>)}
  </div>;
}

function ClipCard({ work, clip, quote, apply, setError, goTab }: WorkbenchProps & { clip: DirectorClip; quote?: ClipQuote }) {
  const { modal } = useStudioApp();
  // 没保存的镜头或提示词修改切走再回来还在，对应的编辑区保持打开。
  const [editing, setEditing] = useState(() => hasDrafts(`${work.id}:clip:${clip.id}:edit:`));
  const [showPrompts, setShowPrompts] = useState(() => hasDrafts(`${work.id}:clip:${clip.id}:prompt:`));
  const { busy, run } = useBusy();
  const board = adopted(clip.board);
  const generating = runningTask(work, `board:${clip.id}`);
  const linked = clip.assetIds.map(id => work.assets.find(a => a.id === id)).filter(Boolean) as DirectorWork["assets"];
  const visual = linked.filter(a => !a.description.includes("只出声音"));
  const missing = visual.filter(a => !a.image.adoptedId);
  const unconfirmed = visual.filter(a => a.image.adoptedBy === "auto");
  const blockReason = clip.issues.length ? "请先处理上方问题" : missing.length ? `缺少参考图：${missing.map(a => a.name).join("、")}` : unconfirmed.length ? `参考图待确认：${unconfirmed.map(a => a.name).join("、")}` : "";
  const generate = () => void run("board", async () => {
    const cost = work.pricing.image;
    const billing = await chooseDirectorBilling("image", cost);
    apply(await DirectorApi.runTask(work.id, { type: "board", targetId: clip.id, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, setError);
  const remove = () => modal.confirm({ title: `删除片段 ${clip.order}？`, content: "片段内的镜头和分镜图将一并移除。", okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
    onOk: () => run("delete", async () => apply(await DirectorApi.edit(work.id, "clip.delete", clip.id, null)), setError) });
  const status = generating ? "分镜图生成中" : clip.video.pending?.length ? "视频生成中" : clip.issues.length ? "需修改" : !board ? "待生成分镜图"
    : clip.board.adoptedCheck === "outdated" ? "分镜图需更新" : clip.board.adoptedBy === "auto" ? "分镜图待确认" : !clip.video.adoptedId ? "待生成视频"
    : clip.video.adoptedCheck === "outdated" ? "视频需更新" : clip.video.adoptedBy === "auto" ? "视频待确认" : "视频已确认";
  return <article className={`director-clip ${clip.issues.length ? "has-issues" : ""}`}>
    <header className="director-clip-head">
      <span className="director-clip-no">{clip.order}</span>
      <div><h4 title={clip.title}>{clip.title || `片段 ${clip.order}`}</h4><p>{clip.durationSec} 秒 · {clip.shots.length} 镜 · {status}</p></div>
      <span className="director-spacer"/>
      {!editing && <button type="button" className="ip-brand-text-button" onClick={() => setEditing(true)}>编辑</button>}
      <button type="button" className="ip-brand-text-button director-danger" aria-label="删除片段" onClick={remove}><Trash2 size={14}/></button>
    </header>
    {clip.summary && <p className="director-clip-summary">{clip.summary}</p>}
    {clip.issues.length > 0 && <div className="director-issues" role="alert"><AlertTriangle size={15}/><ul>{clip.issues.map(i => <li key={i}>{i}</li>)}</ul></div>}
    {editing ? <ClipEditor work={work} clip={clip} apply={apply} setError={setError} onDone={() => setEditing(false)}/> :
      <div className="director-clip-body">
        <div className="director-board">
          <div className={`director-board-frame ratio-${work.settings.aspectRatio.replace(":", "x")}`}>
            {board?.url ? <img src={board.url} alt={`片段 ${clip.order} 的分镜图`}/> : <div className="director-asset-placeholder"><LayoutGrid size={22}/><span>{clip.shots.length > 1 ? "2×2 分镜图" : "分镜画面"}</span></div>}
            {generating && <div className="director-asset-overlay"><Spinner label="生成中"/></div>}
            {clip.board.adoptedBy === "auto" && <span className="director-tag is-warn">待确认</span>}
            {board?.mock && <span className="director-tag">测试图</span>}
          </div>
          <InlineError message={clip.board.error?.message}/>
          <OutdatedNote slot={clip.board} what="张分镜图" onRegenerate={blockReason ? undefined : generate} disabled={!!busy || !!generating}/>
          <VersionStrip slot={clip.board} label={`片段 ${clip.order} 分镜图`} disabled={!!busy} onAdopt={id => void run("adopt", async () => apply(await DirectorApi.edit(work.id, "clip.adoptBoard", clip.id, null, { candidateId: id })), setError)}/>
          <div className="director-card-actions">
            {clip.board.adoptedBy === "auto" && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "clip.confirmBoard", clip.id, null)), setError)}><Check size={14}/>确认</button>}
            <button type="button" className={board ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy || !!generating || !!blockReason} onClick={generate}>
              <Wand2 size={14}/>{clip.board.candidates.length ? "重新生成" : "生成分镜图"}</button>
          </div>
          <small className="director-cost">{blockReason || (work.pricing.mock ? costText(0, true) : `每张${costText(work.pricing.image, false)}`)}</small>
          {board?.refs && board.refs.length > 0 && <p className="director-used-refs">参考：{board.refs.map(r => `${r.label} ${r.name}`).join("、")}</p>}
        </div>
        <div className="director-shots">
          <div className="director-linked"><span>关联资产</span>{linked.length === 0 ? <em>未关联</em> : linked.map(a => {
            const img = adopted(a.image);
            return <button key={a.id} type="button" className={`director-chip ${!a.image.adoptedId && !a.description.includes("只出声音") ? "is-missing" : a.image.adoptedBy === "auto" ? "is-warn" : ""}`} onClick={() => goTab("assets")} title={!a.image.adoptedId ? "缺少参考图，请在资产中生成或上传" : a.image.adoptedBy === "auto" ? "参考图待确认" : kindLabel[a.kind]}>
              {img?.url ? <img src={img.url} alt=""/> : <span className="director-chip-dot"/>}{a.name}</button>;
          })}</div>
          <ol className="director-shot-list">{clip.shots.map((s, i) => <li key={s.id}>
            <div className="director-shot-meta"><b>{clip.shots.length > 1 && i < 4 ? CELLS[i] : `镜头 ${i + 1}`}</b><span>{s.startSec}–{s.endSec} 秒 · {s.size}</span></div>
            <p><strong>画面：</strong>{s.still}</p>
            <p><strong>动作：</strong>{s.action}</p>
            {s.camera && <p className="director-muted">{s.camera}</p>}
            {s.dialogue.map((l, j) => <p key={j} className="director-line"><strong>{speakerName(work, l.speakerId)}：</strong>“{l.text}”</p>)}
          </li>)}</ol>
          <button type="button" className="director-disclosure" aria-expanded={showPrompts} onClick={() => setShowPrompts(s => !s)}>提示词{(clip.boardPromptCustom || clip.videoPromptCustom) && <em>已自定义</em>}</button>
          {showPrompts && <Prompts work={work} clip={clip} apply={apply} setError={setError}/>}
          <ClipVideo work={work} clip={clip} quote={quote} apply={apply} setError={setError}/>
        </div>
      </div>}
  </article>;
}

function speakerName(work: DirectorWork, id: string | null) {
  if (!id) return "旁白";
  return work.assets.find(a => a.id === id)?.name ?? `未知角色（${id}）`;
}

function Prompts({ work, clip, apply, setError }: { work: DirectorWork; clip: DirectorClip; apply: (w: DirectorWork) => void; setError: (m: string) => void }) {
  const prefix = `${work.id}:clip:${clip.id}:prompt:`;
  const [board, setBoard, boardDirty] = useDraft(prefix + "board", clip.boardPrompt);
  const [video, setVideo, videoDirty] = useDraft(prefix + "video", clip.videoPrompt);
  const { busy, run } = useBusy();
  const save = (data: object, which: "board" | "video") => void run("prompt", async () => {
    const next = await DirectorApi.edit(work.id, "clip.update", clip.id, clip.rev, data);
    clearDrafts(prefix + which); apply(next);
  }, setError);
  return <div className="director-prompts">
    <label className="director-field"><span>分镜图提示词 {clip.boardPromptCustom ? <em>已自定义，镜头修改不再同步</em> : <em>随镜头自动生成</em>}</span>
      <textarea className="director-prompt" rows={8} maxLength={7000} value={board} onChange={e => setBoard(e.target.value)}/></label>
    <div className="director-actions">
      <button type="button" className="ip-brand-secondary" disabled={!!busy || !boardDirty} onClick={() => save({ boardPrompt: board }, "board")}>保存</button>
      {boardDirty && <span className="director-unsaved">未保存</span>}
      {clip.boardPromptCustom && <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => save({ resetBoardPrompt: true }, "board")}><RefreshCw size={13}/>恢复自动生成</button>}
    </div>
    <label className="director-field"><span>视频提示词 {clip.videoPromptCustom ? <em>已自定义</em> : <em>随镜头自动生成</em>}</span>
      <textarea className="director-prompt" rows={8} maxLength={7000} value={video} onChange={e => setVideo(e.target.value)}/></label>
    <div className="director-actions">
      <button type="button" className="ip-brand-secondary" disabled={!!busy || !videoDirty} onClick={() => save({ videoPrompt: video }, "video")}>保存</button>
      {videoDirty && <span className="director-unsaved">未保存</span>}
      {clip.videoPromptCustom && <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => save({ resetVideoPrompt: true }, "video")}><RefreshCw size={13}/>恢复自动生成</button>}
    </div>
    <p className="director-dialog-note">{work.videoLimits?.mode === "frame" ? "分镜图中的图N对应角色、场景和道具参考图；视频仅使用已确认的分镜首帧。" : "「图N」按顺序对应实际提交的参考图：分镜图中图1起依次为角色、场景、道具；视频中图1为分镜图，其后依次为上述资产。"}</p>
  </div>;
}

type ShotDraft = Omit<DirectorShot, "startSec" | "endSec"> & { durationText: string };

function ClipEditor({ work, clip, apply, setError, onDone }: { work: DirectorWork; clip: DirectorClip; apply: (w: DirectorWork) => void; setError: (m: string) => void; onDone: () => void }) {
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
        <select aria-label="说话人" value={l.speakerId ?? ""} onChange={e => update(i, { dialogue: s.dialogue.map((x, k) => k === j ? { ...x, speakerId: e.target.value || null } : x) })}>
          <option value="">旁白 / 画外音</option>
          {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          {l.speakerId && !characters.some(c => c.id === l.speakerId) && <option value={l.speakerId}>未知角色（{l.speakerId}）</option>}
        </select>
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
