"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Download, Film, Play, SkipForward, Wand2, X } from "lucide-react";
import type { DirectorClip, DirectorEpisode, DirectorWork } from "@ai-star-eco/types";
import { downloadMedia } from "@/canvas-bridge/download-media";
import { formatDateTime } from "@/lib/datetime";
import { DirectorApi } from "../api";
import { InlineError, OutdatedNote, Spinner, adopted, chooseDirectorBilling, costText, newRequestId, runningTask, useBusy, useEscape, dialogFocus } from "./director-shared";

export type ClipQuote = { credits: number | null; error: string | null };

/** 片段的视频操作：报价、生成、进度与确认。画面和历史版本在左侧画面区。 */
/** 片段视频的操作区：提示（生成中、声音、旧版本）在上，最后一行是生成设置 + 按钮 + 价格。onBoard：分镜图还没好时给「去生成分镜图」。 */
export function ClipVideo({ work, clip, quote, apply, setError, onBoard, settings }: { work: DirectorWork; clip: DirectorClip; quote?: ClipQuote; apply: (w: DirectorWork) => void; setError: (m: string) => void;
  onBoard?: () => void; settings?: string }) {
  const { busy, run } = useBusy();
  const current = adopted(clip.video);
  const pending = clip.video.pending?.[0];
  const fixtureRun = runningTask(work, `video:${clip.id}`);
  const boardReady = !!clip.board.adoptedId && clip.board.adoptedBy === "user";
  const generate = () => void run("video", async () => {
    const latest = (await DirectorApi.quote(work.id, [clip.id])).items[0];
    if (latest?.error || latest?.credits == null) throw new Error(latest?.error || "该片段暂不能生成视频");
    const billing = await chooseDirectorBilling("video", latest.credits);
    apply(await DirectorApi.runTask(work.id, { type: "video", targetId: clip.id, clientRequestId: newRequestId(), billing, maxCost: latest.credits }));
  }, setError);
  const frame = work.videoLimits?.mode === "frame";
  const voiceBlocked = frame && (clip.voiced?.length ?? 0) > 0 && !clip.videoWithoutVoice;
  const reason = clip.issues.length ? "先处理上面标出的问题" : !clip.board.adoptedId ? "请先生成分镜图" : !boardReady ? "请先确认分镜图" : quote?.error ?? (voiceBlocked ? "请先选择不带声音参考" : "");
  const setVoiceMode = (withoutVoice: boolean) => void run("voice", async () => apply(await DirectorApi.edit(work.id, "clip.setVoiceMode", clip.id, null, { withoutVoice })), setError);
  return <div className="director-video">
    {(pending || fixtureRun) && <Spinner label={pending ? `视频生成中：${pending.stage}${pending.pct ? ` ${pending.pct}%` : ""}。约需数分钟，关闭页面不中断` : "视频生成中"}/>}
    {frame && (clip.voiced?.length ?? 0) > 0 && <div className="director-voice-warn">
      <AlertTriangle size={13}/>
      <span>当前视频模型不支持声音参考，{clip.voiced!.join("、")} 的声音本次不使用，声音绑定保留。</span>
      <label className="director-voice-toggle"><input type="checkbox" checked={!!clip.videoWithoutVoice} disabled={!!busy} onChange={e => setVoiceMode(e.target.checked)}/>不带声音参考生成</label>
    </div>}
    {!frame && (clip.unvoiced?.length ?? 0) > 0 && <p className="director-voice-warn"><AlertTriangle size={13}/>{clip.unvoiced.join("、")} 未绑定声音，各片段音色可能不一致。可在「资产」中绑定。</p>}
    <InlineError message={clip.video.error?.message}/>
    <OutdatedNote slot={clip.video} what="条视频" onRegenerate={reason || pending || fixtureRun ? undefined : generate} disabled={!!busy}/>
    <div className="director-card-actions director-video-actions">
      {settings && <span className="director-video-settings" title={settings}>{settings}</span>}
      <span className="director-spacer"/>
      {onBoard && <button type="button" className="ip-brand-button" onClick={onBoard}>{!clip.board.adoptedId ? "去生成分镜图" : "确认分镜图"}</button>}
      {clip.video.adoptedBy === "auto" && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "clip.confirmVideo", clip.id, null)), setError)}><Check size={14}/>确认使用</button>}
      <button type="button" className={current || onBoard ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy || !!pending || !!fixtureRun || !!reason} onClick={generate}>
        <Wand2 size={14}/>{clip.video.candidates.length ? "重新生成视频" : "生成片段视频"}</button>
      <span className="director-cost director-video-cost" title={reason || (current?.refs?.length ? `参考：${current.refs.map(r => `${r.label} ${r.name}`).join("、")}` : undefined)}>{reason || (quote?.credits != null ? `${clip.durationSec} 秒，${costText(quote.credits, work.pricing.mock)}` : "报价中…")}</span>
    </div>
  </div>;
}

/** 本集成片：按片段顺序连播已采用的视频，缺的段明确标出；整集导出按当时采用的版本合成。 */
export function EpisodeOutput({ work, ep, apply, setError }: { work: DirectorWork; ep: DirectorEpisode; apply: (w: DirectorWork) => void; setError: (m: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const { busy, run } = useBusy();
  const clips = work.clips.filter(c => c.episodeId === ep.id).sort((a, b) => a.order - b.order);
  const withVideo = clips.filter(c => adopted(c.video));
  const missing = clips.filter(c => !adopted(c.video)).map(c => `片段 ${c.order}`);
  const unconfirmed = clips.filter(c => c.video.adoptedBy === "auto").map(c => `片段 ${c.order}`);
  const outdated = clips.filter(c => c.video.adoptedId && c.video.adoptedCheck === "outdated").map(c => `片段 ${c.order}`);
  const exports = (work.exports ?? []).filter(e => e.episodeId === ep.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exporting = runningTask(work, `export:${ep.id}`);
  const exportReason = !clips.length ? "暂无片段" : missing.length ? `缺少视频：${missing.join("、")}` : unconfirmed.length ? `待确认视频：${unconfirmed.join("、")}` : "";
  const exportNow = () => void run("export", async () => apply(await DirectorApi.runTask(work.id, { type: "export", targetId: ep.id, clientRequestId: newRequestId() })), setError);
  const [showExports, setShowExports] = useState(false);
  if (!clips.length) return null;
  const latest = exports[0];
  return <div className="director-output">
    <span className="director-output-count" title={missing.length ? `缺少视频：${missing.join("、")}` : undefined}>视频 {withVideo.length}/{clips.length}</span>
    <button type="button" className="ip-brand-secondary" disabled={!withVideo.length} onClick={() => setPlaying(true)}><Play size={14}/>连播预览</button>
    {exporting ? <Spinner label="整集合成中"/> :
      <button type="button" className="ip-brand-button" disabled={!!busy || !!exportReason}
        title={exportReason ? `${exportReason}。导出免费。` : outdated.length ? `${outdated.join("、")} 的视频需更新。导出将使用当前版本，如需新设置请先重新生成并采用。` : "导出免费"} onClick={exportNow}><Film size={14}/>导出整集</button>}
    {!exportReason && outdated.length > 0 && <span className="director-output-warn" title={`${outdated.join("、")} 的视频需更新。导出将使用当前版本，如需新设置请先重新生成并采用。`}><AlertTriangle size={13}/>含需更新视频</span>}
    {latest && <button type="button" className="director-output-toggle" aria-expanded={showExports} onClick={() => setShowExports(s => !s)}>导出记录 {exports.length}<ChevronDown size={13}/></button>}
    {showExports && <ul className="director-exports">{exports.slice(0, 5).map(e => {
      const stale = e.status === "done" && (e.clips.length !== clips.length || e.clips.some(x => clips.find(c => c.id === x.clipId)?.video.adoptedId !== x.candidateId));
      const oldInside = e.status === "done" && !stale && e.clips.some(x => clips.find(c => c.id === x.clipId)?.video.adoptedCheck === "outdated");
      return <li key={e.id}>
        <span>{formatDateTime(e.createdAt)}</span>
        {e.status === "running" && <Spinner label="合成中"/>}
        {e.status === "failed" && <span className="director-danger">合成失败：{e.error}</span>}
        {e.status === "done" && <>
          <span>{e.durationSec ? `${Math.round(e.durationSec)} 秒` : ""}</span>
          {stale && <span className="director-tag-inline is-warn" title="导出后片段视频或顺序有变动">非最新版本</span>}
          {oldInside && <span className="director-tag-inline is-warn" title="部分片段视频与当前设置不一致">含需更新视频</span>}
          {e.url && <a href={e.url} target="_blank" rel="noreferrer">播放</a>}
          {e.url && <button type="button" className="ip-brand-text-button" onClick={() => void downloadMedia(e.url!, `${work.title}-第${ep.no}集`, "video/mp4", e.key)}><Download size={13}/>下载</button>}
        </>}
      </li>;
    })}</ul>}
    {playing && <SequencePlayer work={work} clips={clips} onClose={() => setPlaying(false)}/>}
  </div>;
}

function SequencePlayer({ work, clips, onClose }: { work: DirectorWork; clips: DirectorClip[]; onClose: () => void }) {
  useEscape(onClose);
  const playable = useMemo(() => clips.map(c => ({ clip: c, url: adopted(c.video)?.url ?? null })), [clips]);
  const firstPlayable = Math.max(0, playable.findIndex(p => p.url));
  const [index, setIndex] = useState(firstPlayable);
  const ref = useRef<HTMLVideoElement>(null);
  const current = playable[index];
  const nextIndex = playable.findIndex((p, i) => i > index && p.url);
  const [finished, setFinished] = useState(false);
  const next = () => { if (nextIndex >= 0) { setFinished(false); setIndex(nextIndex); } else setFinished(true); };
  useEffect(() => { const v = ref.current; if (v && current?.url) { v.load(); void v.play().catch(() => { /* 浏览器拦了自动播放，用户点播放即可 */ }); } }, [index, current?.url]);
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-dialog director-player" role="dialog" aria-modal="true" aria-labelledby="director-player-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-player-title">连播预览</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18}/></button></header>
      <div className={`director-player-stage ratio-${work.settings.aspectRatio.replace(":", "x")}`}>
        {current?.url ? <video ref={ref} src={current.url} controls playsInline onEnded={next}/> : <p>该片段暂无视频</p>}
      </div>
      <ol className="director-player-list">{playable.map((p, i) => <li key={p.clip.id}>
        <button type="button" aria-current={i === index ? "true" : undefined} disabled={!p.url} onClick={() => { setFinished(false); setIndex(i); }}>
          <b>{p.clip.order}</b><span>{p.clip.title || `片段 ${p.clip.order}`}</span><small>{p.url ? `${p.clip.durationSec} 秒` : "无视频，跳过"}</small>
        </button></li>)}</ol>
      <p className="director-dialog-note">按顺序播放已采用的视频，无视频的片段跳过。成片以「导出整集」为准。</p>
      <footer>{nextIndex >= 0 ? <button type="button" className="ip-brand-secondary" onClick={next}><SkipForward size={14}/>下一段</button>
        : <span className="director-cost">{finished ? "播放完成" : "已是最后一段"}</span>}</footer>
    </div>
  </div>;
}
