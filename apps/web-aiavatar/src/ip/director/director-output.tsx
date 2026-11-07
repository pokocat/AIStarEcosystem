"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Download, Film, Music, Play, SkipForward, Trash2, Upload, Wand2, X } from "lucide-react";
import { Switch } from "antd";
import type { DirectorClip, DirectorEpisode, DirectorExport, DirectorExportOptions, DirectorWork } from "@ai-star-eco/types";
import { SignedAudio } from "@/canvas-bridge/signed-audio";
import { studioCaptionNote } from "@/canvas-bridge/studio-packaging";
import { downloadMedia } from "@/canvas-bridge/download-media";
import { formatDateTime } from "@/lib/datetime";
import { DirectorApi } from "../api";
import { VoiceDialog } from "./director-voice";
import { DIRECTOR_MEDIA_SHORTAGE, InlineError, OutdatedNote, Spinner, adopted, chooseDirectorBilling, costText, errorText, exportIsStale, failed, newRequestId, runningTask, useBusy, useElapsedSeconds, useEscape, dialogFocus, type DirectorFail } from "./director-shared";

export type ClipQuote = { credits: number | null; error: string | null };

/** 片段的视频操作：报价、生成、进度与确认。画面和历史版本在左侧画面区。 */
/** 片段视频的操作区：提示（生成中、声音、旧版本）在上，最后一行是生成设置 + 按钮 + 价格。onBoard：分镜图还没好时给「去生成分镜图」。 */
export function ClipVideo({ work, clip, quote, apply, setError, onBoard, onAssets, onPickVideo, switching, settings }: { work: DirectorWork; clip: DirectorClip; quote?: ClipQuote; apply: (w: DirectorWork) => void; setError: DirectorFail; onPickVideo?: (candidateId: string) => void; switching?: boolean;
  onBoard?: () => void; onAssets?: () => void; settings?: string }) {
  const { busy, run } = useBusy();
  // 已经有视频时，重新生成要花钱：先说清花多少、现有版本还在，再点一次才执行。第一次生成按钮旁已写价格，不多问。
  const [confirmRegenerate, setConfirmRegenerate] = useState<{ choice?: "optimized" | "original" } | null>(null);
  const current = adopted(clip.video);
  const pending = clip.video.pending?.[0];
  const fixtureRun = runningTask(work, `video:${clip.id}`);
  const rewriting = runningTask(work, `videoPrompt:${clip.id}`);
  const boardReady = !!clip.board.adoptedId && clip.board.adoptedBy === "user";
  // promptChoice：优化稿有提示时用户的选择，或随时「按原文生成」（不拦人，2026-10-26 用户定）。
  const generate = (promptChoice?: "optimized" | "original") => void run("video", async () => {
    const latest = (await DirectorApi.quote(work.id, [clip.id])).items[0];
    if (latest?.error || latest?.credits == null) throw new Error(latest?.error || "此片段暂无法生成视频");
    const billing = await chooseDirectorBilling("video", latest.credits);
    apply(await DirectorApi.runTask(work.id, { type: "video", targetId: clip.id, clientRequestId: newRequestId(), billing, maxCost: latest.credits,
      ...(promptChoice ? { options: { promptChoice } } : {}) }));
  }, failed(setError, `生成片段 ${clip.order} 的视频`, undefined, undefined, DIRECTOR_MEDIA_SHORTAGE));
  // 重新优化：只重新改写提示词，完成后停在新稿上等你选，不接着生成视频；优化提示词按实际用量另计。
  const reoptimize = () => void run("rewrite", async () => {
    const billing = await chooseDirectorBilling("text");
    apply(await DirectorApi.runTask(work.id, { type: "video-prompt", targetId: clip.id, clientRequestId: newRequestId(), billing }));
  }, failed(setError, `重新优化片段 ${clip.order} 的提示词`));
  // 所有会花钱的「再生成一条」都走这里，不留绕过确认的按钮。
  const paid = (choice?: "optimized" | "original") => { if (clip.video.candidates.length) setConfirmRegenerate({ choice }); else generate(choice); };
  const rewrite = clip.videoPromptRewrite;
  const draftTooLong = clip.videoPromptEn?.usable === false;
  const review = rewrite === "review";
  const frame = work.videoLimits?.mode === "frame";
  const voiceBlocked = frame && (clip.voiced?.length ?? 0) > 0 && !clip.videoWithoutVoice;
  const reason = clip.issues.length ? "请先处理上方标出的问题" : !clip.board.adoptedId ? "请先生成分镜图" : !boardReady ? "请先确认分镜图" : quote?.error ?? (voiceBlocked ? "请先选择不带声音参考" : "");
  const priceText = quote?.credits != null ? `${clip.durationSec} 秒，${costText(quote.credits, work.pricing.mock)}${rewrite === "needed" ? "，优化另需少量积分" : rewrite === "original" ? "，当前按原文生成" : ""}` : "";
  // 没设音色的人物就地设置，不用跳到资产页再找。找不到对应资产（改过名）才去资产页。
  const [voiceFor, setVoiceFor] = useState<string>();
  const voiceAsset = work.assets.find(a => a.id === voiceFor);
  const voiceOf = (name: string) => work.assets.find(a => a.kind === "character" && a.name === name);
  const voiceButtons = (clip.unvoiced ?? []).map(name => {
    const target = voiceOf(name);
    const label = clip.unvoiced.length > 1 ? `设置${name}的音色` : "设置音色";
    return target ? <button key={name} type="button" className="ip-brand-text-button" onClick={() => setVoiceFor(target.id)}>{label}</button>
      : onAssets ? <button key={name} type="button" className="ip-brand-text-button" onClick={onAssets}>{label}</button> : null;
  });
  // 最新一版没在用：要么刚生成，要么用户点了「保留」或主动换回旧版（记在本机，不再提示）。
  const candidates = clip.video.candidates;
  const newest = candidates[candidates.length - 1];
  const usedIndex = candidates.findIndex(m => m.id === clip.video.adoptedId);
  const [kept, setKept] = useState(() => { try { return localStorage.getItem(`director-kept-video:${clip.id}`) ?? ""; } catch { return ""; } });
  const keepCurrent = () => { if (!newest) return; setKept(newest.id); try { localStorage.setItem(`director-kept-video:${clip.id}`, newest.id); } catch { /* 只是不再提示，存不下也没关系 */ } };
  // 用户自己换到旧版本（不是新版本刚出来）：就是想用这一版，不再提示有新版本。
  const lastAdopted = useRef(clip.video.adoptedId);
  useEffect(() => {
    if (lastAdopted.current !== clip.video.adoptedId && newest && clip.video.adoptedId !== newest.id) keepCurrent();
    lastAdopted.current = clip.video.adoptedId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.video.adoptedId]);
  const newer = newest && usedIndex >= 0 && usedIndex < candidates.length - 1 && newest.url && !newest.stale && kept !== newest.id
    ? { id: newest.id, no: candidates.length, usedNo: usedIndex + 1 } : undefined;
  const setVoiceMode = (withoutVoice: boolean) => void run("voice", async () => apply(await DirectorApi.edit(work.id, "clip.setVoiceMode", clip.id, null, { withoutVoice })), failed(setError, withoutVoice ? `设置片段 ${clip.order} 不带声音参考` : `恢复片段 ${clip.order} 的声音参考`));
  return <div className="director-video">
    {rewriting && !pending && <Spinner label={rewriting.draftOnly ? "正在重新优化提示词，完成后可选择使用哪一份" : "正在优化提示词，完成后自动开始生成视频"}/>}
    {(pending || fixtureRun) && <Spinner label={pending ? `视频生成中：${pending.stage}${pending.pct ? ` ${pending.pct}%` : ""}。通常需要几分钟，关闭页面不影响生成` : "视频生成中"}/>}
    {frame && (clip.voiced?.length ?? 0) > 0 && <div className="director-voice-warn">
      <AlertTriangle size={13}/>
      <span>当前视频模型不支持声音参考，{clip.voiced!.join("、")} 的声音本次不使用，声音绑定保留。</span>
      <label className="director-voice-toggle"><input type="checkbox" checked={!!clip.videoWithoutVoice} disabled={!!busy} onChange={e => setVoiceMode(e.target.checked)}/>不带声音参考生成</label>
    </div>}
    {/* 还没生成：现在绑定最省事，给入口。已经生成：绑定不会改变这条视频，如实说，不再用警告吓人。 */}
    {!frame && (clip.unvoiced?.length ?? 0) > 0 && (current
      ? <div className="director-voice-note"><span>{clip.unvoiced.join("、")} 未设置音色。设置后需要重新生成视频才会生效。</span>{voiceButtons}</div>
      : <div className="director-voice-warn"><AlertTriangle size={13}/><span>{clip.unvoiced.join("、")} 未设置音色，各片段的声音可能不一致。</span>{voiceButtons}</div>)}
    {voiceAsset && <VoiceDialog work={work} asset={voiceAsset} apply={apply} onClose={() => setVoiceFor(undefined)}/>}
    {/* 重新生成的视频不会自动替换，这里说清楚，不然花了钱却看不到变化。 */}
    {newer && !pending && !fixtureRun && <div className="director-video-confirm" role="status">
      <span>第 {newer.no} 版视频已生成。现在用的还是第 {newer.usedNo} 版。</span>
      <button type="button" className="ip-brand-secondary" onClick={keepCurrent}>保留第 {newer.usedNo} 版</button>
      <button type="button" className="ip-brand-button" disabled={!!switching} onClick={() => onPickVideo?.(newer.id)}>换成第 {newer.no} 版</button>
    </div>}
    <InlineError message={clip.video.error?.message}/>
    {review && !rewriting && !pending && <div className="director-prompt-review" role="group" aria-label="优化稿待确认">
      <strong><AlertTriangle size={13}/>{draftTooLong ? "AI 优化后的版本太长，无法使用" : "AI 优化后的版本有几处需要留意"}</strong>
      {!!clip.videoPromptEn?.warnings?.length && <ul>{clip.videoPromptEn.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      <div className="director-card-actions">
        {!draftTooLong && <button type="button" className="ip-brand-button" disabled={!!busy || !!reason} onClick={() => paid("optimized")}>用优化后的版本（推荐）</button>}
        <button type="button" className="ip-brand-secondary" disabled={!!busy || !!reason} onClick={() => paid("original")}>用原来的版本</button>
        <button type="button" className="ip-brand-text-button" disabled={!!busy || !!reason} title="只改写提示词，不生成视频。优化提示词按实际用量另计。" onClick={reoptimize}>重新优化</button>
      </div>
    </div>}
    {current?.promptUsed && <p className="director-sent-prompt-note">{promptUsedText(current)}</p>}
    <OutdatedNote slot={clip.video} what="条视频" onRegenerate={reason || pending || fixtureRun || rewriting || review ? undefined : () => paid()} disabled={!!busy}/>
    {/* 确认单独一行，和要花钱的重新生成隔开。 */}
    {clip.video.adoptedBy === "auto" && <div className="director-video-confirm">
      <span>看过这条视频后，点「确认使用」。也可以直接导出整集，导出时一并确认。</span>
      <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "clip.confirmVideo", clip.id, null)), failed(setError, `确认片段 ${clip.order} 的视频`))}><Check size={14}/>确认使用</button>
    </div>}
    <div className="director-card-actions director-video-actions">
      {settings && <span className="director-video-settings" title={settings}>{settings}</span>}
      <span className="director-spacer"/>
      {onBoard && <button type="button" className="ip-brand-button" onClick={onBoard}>{!clip.board.adoptedId ? "生成分镜图" : "确认分镜图"}</button>}
      {(rewrite === "needed" || rewrite === "ready") && <button type="button" className="ip-brand-text-button" disabled={!!busy || !!pending || !!fixtureRun || !!rewriting || !!reason}
        title="不优化，直接将中文提示词发送给视频模型" onClick={() => paid("original")}>不优化，直接生成</button>}
      {rewrite === "original" && (draftTooLong
        ? <button type="button" className="ip-brand-text-button" disabled={!!busy || !!pending || !!fixtureRun || !!rewriting || !!reason}
            title="上一份优化稿过长，无法使用。只改写提示词，不生成视频。优化提示词按实际用量另计。" onClick={reoptimize}>重新优化</button>
        : <button type="button" className="ip-brand-text-button" disabled={!!busy || !!pending || !!fixtureRun || !!rewriting || !!reason}
            title="按 H3 官方写法优化提示词后生成视频。优化提示词按实际用量另计。" onClick={() => paid("optimized")}>{clip.video.candidates.length ? "用智能优化重新生成" : "用智能优化生成"}</button>)}
      {confirmRegenerate ? <div className="director-regenerate-confirm" role="group" aria-label="确认重新生成">
          <span>重新生成一条 {clip.durationSec} 秒的视频，{quote?.credits != null ? costText(quote.credits, work.pricing.mock) : "费用以生成时的报价为准"}{(confirmRegenerate.choice === "optimized" && !review) || (!confirmRegenerate.choice && rewrite === "needed") ? "，优化另需少量积分" : ""}。现有版本会保留，新版本生成后由你决定是否换用。</span>
          <button type="button" className="ip-brand-secondary" onClick={() => setConfirmRegenerate(null)}>取消</button>
          <button type="button" className="ip-brand-button" disabled={!!busy || !!pending || !!fixtureRun || !!rewriting || !!reason || (review && !confirmRegenerate.choice)} onClick={() => { const { choice } = confirmRegenerate; setConfirmRegenerate(null); generate(choice); }}>确定重新生成</button>
        </div> : <>
        <button type="button" className={current || onBoard ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy || !!pending || !!fixtureRun || !!rewriting || !!reason || review} onClick={() => paid()}>
          <Wand2 size={14}/>{clip.video.candidates.length ? "重新生成视频" : "生成片段视频"}</button>
        <span className="director-cost director-video-cost" title={reason || [priceText, current?.refs?.length ? `参考：${current.refs.map(r => `${r.label} ${r.name}`).join("、")}` : ""].filter(Boolean).join("\n") || undefined}>{reason || priceText || "报价中…"}</span>
      </>}
    </div>
  </div>;
}

/** 当前这条视频用的是哪份提示词：提交时记下的，不按片段现在的状态推。花费是那份优化稿的，同一份稿出多条视频只扣过一次。 */
export function promptUsedText(v: { promptUsed?: "optimized" | "original"; promptReason?: string; rewriteCost?: number }): string {
  const why = v.promptReason === "too_long" ? "（优化稿过长，未使用）" : v.promptReason === "rewrite_failed" ? "（优化失败）" : v.promptReason === "user" ? "（手动选择）" : "";
  const head = v.promptUsed === "optimized" ? "此视频使用优化后的提示词" : `此视频使用中文原文提示词${why}`;
  return v.rewriteCost ? `${head}，优化消耗 ${v.rewriteCost.toLocaleString()} 积分` : head;
}

/** 本集成片：按片段顺序连播已采用的视频，缺的段明确标出；整集导出按当时采用的版本合成。 */
export function EpisodeOutput({ work, ep, apply, setError }: { work: DirectorWork; ep: DirectorEpisode; apply: (w: DirectorWork) => void; setError: DirectorFail }) {
  const [playing, setPlaying] = useState(false);
  const { busy, run } = useBusy();
  const clips = work.clips.filter(c => c.episodeId === ep.id).sort((a, b) => a.order - b.order);
  const withVideo = clips.filter(c => adopted(c.video));
  // 还在生成的不算缺：点过去也只能看转圈。
  const generating = clips.filter(c => c.video.pending?.length || runningTask(work, `video:${c.id}`));
  const missing = clips.filter(c => !adopted(c.video) && !generating.includes(c)).map(c => `片段 ${c.order}`);
  const unconfirmed = clips.filter(c => c.video.adoptedId && c.video.adoptedBy === "auto").map(c => `片段 ${c.order}`);
  const outdated = clips.filter(c => c.video.adoptedId && c.video.adoptedCheck === "outdated").map(c => `片段 ${c.order}`);
  const exports = (work.exports ?? []).filter(e => e.episodeId === ep.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const exporting = runningTask(work, `export:${ep.id}`);
  // 只有缺视频才拦：待确认的在对话框里说明，开始导出时一并确认，不用一段段点过去。
  const exportReason = !clips.length ? "暂无片段" : missing.length ? `缺少视频：${missing.join("、")}` : generating.length && withVideo.length < clips.length ? `${generating.length} 段视频生成中，完成后可以导出` : "";
  const [exportOpen, setExportOpen] = useState(false);
  const [watching, setWatching] = useState<DirectorExport>();
  const [showExports, setShowExports] = useState(false);
  const records = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // 顶栏是固定的：按钮滑到顶栏底下时人已经看不见它了，这里要算进去。
    const bar = parseInt(getComputedStyle(document.body).getPropertyValue("--desktop-bar-h"), 10) || 0;
    const seen = new IntersectionObserver(([entry]) => setAway(!entry.isIntersecting), { rootMargin: `-${bar}px 0px 0px 0px` });
    seen.observe(el);
    return () => seen.disconnect();
  }, [clips.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showExports) return;
    const close = (e: MouseEvent) => { if (!records.current?.contains(e.target as Node)) setShowExports(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showExports]);
  const [downloading, setDownloading] = useState<string>();
  const [downloadStarted, setDownloadStarted] = useState<string>();
  // 关掉对话框不丢选择；没动过时沿用上一次导出的设置，音乐不用重新上传。
  const [choice, setChoice] = useState<ExportChoice>();
  const latest = exports[0];
  const current = choice ?? exportChoiceOf(latest);
  const startExport = () => run("export", async () => {
    setDownloadStarted(undefined);
    const options: DirectorExportOptions = { captions: current.captions, ...(unconfirmed.length ? { confirmPending: true } : {}), ...(current.quality ? { quality: current.quality } : {}),
      ...(current.music ? { musicStorageKey: current.music.key, musicName: current.music.name } : {}) };
    apply(await DirectorApi.runTask(work.id, { type: "export", targetId: ep.id, clientRequestId: newRequestId(), options }));
    setExportOpen(false); setChoice(undefined);
  }, failed(setError, `导出第 ${ep.no} 集`));
  if (!clips.length) return null;
  // 文件要先取回来才开始保存，片子越长等得越久：按钮要有反应，不然会被连点、下出好几份。
  const download = (e: DirectorExport) => {
    if (downloading) return;
    setDownloading(e.id); setDownloadStarted(undefined);
    void downloadMedia(e.url!, `${work.title}-第${ep.no}集`, "video/mp4", e.key).then(() => setDownloadStarted(e.id), failed(setError, "下载成片")).finally(() => setDownloading(undefined));
  };
  const spotlight = (first?: DirectorClip) => {
    const el = first && document.getElementById(`clip-${first.id}`);
    if (!el) return;
    el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    el.classList.add("is-spotlight");
    window.setTimeout(() => el.classList.remove("is-spotlight"), 2400);
  };
  const goToClip = () => spotlight(clips.find(c => !adopted(c.video) || c.video.adoptedBy === "auto"));
  const goToOutdated = () => spotlight(clips.find(c => c.video.adoptedId && c.video.adoptedCheck === "outdated"));
  const staleExport = (e: DirectorExport) => exportIsStale(e, clips);
  // 成片还是最新的：下一步就是看和下载，重新导出退到次要。
  const finished = !exporting && latest?.status === "done" && latest.url && !staleExport(latest) ? latest : undefined;
  const finishedNote = finished && captionNoteOf(finished);
  return <div className="director-output" ref={anchor}>
    <span className="director-output-count" title={missing.length ? `缺少视频：${missing.join("、")}` : undefined}>视频 {withVideo.length}/{clips.length}</span>
    {!finished && <button type="button" className="ip-brand-secondary" disabled={!withVideo.length} onClick={() => setPlaying(true)}><Play size={14}/>连播预览</button>}
    {exporting ? <Spinner label="导出中"/> : finished ? <>
      <button type="button" className="ip-brand-button" disabled={!!downloading} onClick={() => download(finished)}><Download size={14}/>{downloading === finished.id ? "正在准备下载" : "下载成片"}</button>
      <button type="button" className="ip-brand-secondary" onClick={() => setWatching(finished)}><Play size={14}/>观看成片</button>
    </> :
      <button type="button" className="ip-brand-button" disabled={!!busy || !!exportReason}
        title={exportReason ? `${exportReason}。导出免费。` : outdated.length ? `${outdated.join("、")} 的视频需更新。导出将使用当前版本，如需新设置请先重新生成并采用。` : "导出免费"} onClick={() => setExportOpen(true)}><Film size={14}/>导出整集</button>}
    {!exportReason && outdated.length > 0 && <span className="director-output-warn" title={`${outdated.join("、")} 的视频需更新。导出将使用当前版本，如需新设置请先重新生成并采用。`}><AlertTriangle size={13}/>含需更新视频</span>}
    {!exporting && generating.length > 0 && <span className="director-output-count" role="status">{generating.length} 段视频生成中</span>}
    {!exporting && missing.length > 0 && <span className="director-output-count" title={exportReason}>{missing.length} 个片段缺少视频</span>}
    {!exporting && missing.length > 0 && <button type="button" className="ip-brand-secondary" title={exportReason} onClick={goToClip}>去生成视频（{missing.length}）</button>}
    {!exporting && !missing.length && unconfirmed.length > 0 && <button type="button" className="ip-brand-secondary" title={`待确认视频：${unconfirmed.join("、")}。也可以直接导出，导出时一并确认。`} onClick={goToClip}>去确认（{unconfirmed.length}）</button>}
    {latest && <div className="director-output-records" ref={records}>
      <button type="button" className="director-output-toggle" aria-expanded={showExports} onClick={() => setShowExports(s => !s)}>导出记录 {exports.length}<ChevronDown size={13}/></button>
      {showExports && <ul className="director-exports">{exports.slice(0, 5).map(e => {
        const stale = staleExport(e);
        const oldInside = e.status === "done" && !stale && e.clips.some(x => clips.find(c => c.id === x.clipId)?.video.adoptedCheck === "outdated");
        const note = captionNoteOf(e);
        const settings = [e.captions === false ? "无字幕" : e.captions ? "带字幕" : "", e.quality?.toUpperCase() ?? "", e.musicName ? `背景音乐：${e.musicName}` : ""].filter(Boolean).join(" · ");
        return <li key={e.id}>
          <span>{formatDateTime(e.createdAt)}</span>
          {e.status === "running" && <Spinner label="导出中"/>}
          {e.status === "failed" && <span className="director-danger">导出失败：{e.error}</span>}
          {e.status === "done" && <>
            <span>{e.durationSec ? `${Math.round(e.durationSec)} 秒` : ""}</span>
            {stale && <span className="director-tag-inline is-warn" title="导出后片段视频或顺序有变动">非最新版本</span>}
            {oldInside && <span className="director-tag-inline is-warn" title="部分片段视频与当前设置不一致">含需更新视频</span>}
            {e.url && <button type="button" className="ip-brand-text-button" onClick={() => setWatching(e)}><Play size={13}/>观看</button>}
            {e.url && <button type="button" className="ip-brand-text-button" disabled={!!downloading} onClick={() => download(e)}><Download size={13}/>{downloading === e.id ? "正在准备" : "下载"}</button>}
            {settings && <span className="director-export-note">{settings}</span>}
            {note && <span className={`director-export-note${note.warn ? " is-warn" : ""}`}>{note.text}</span>}
          </>}
        </li>;
      })}</ul>}
    </div>}
    {finished && <button type="button" className="ip-brand-secondary" disabled={!!busy || !!exportReason} onClick={() => setExportOpen(true)}><Film size={14}/>重新导出</button>}
    {exporting && <ExportWaiting since={exporting.createdAt}/>}
    {!exporting && latest?.status === "failed" && <p className="director-output-hint is-error" role="alert">上次导出失败：{latest.error}。片段不受影响，可重新导出。</p>}
    {!exporting && latest?.status === "done" && !finished && <p className="director-output-hint is-warn" role="status">片段有变动，已导出的成片不是最新版本，请重新导出。</p>}
    {finished && !showExports && <p className={`director-output-hint${finishedNote?.warn ? " is-warn" : ""}`} role="status">第 {ep.no} 集已导出{finished.durationSec ? `，时长 ${formatLength(finished.durationSec)}` : ""}。{finishedNote?.text}</p>}
    {finished && downloadStarted === finished.id && !downloading && <p className="director-output-hint" role="status">已开始下载，可在浏览器的下载列表中查看。</p>}
    {/* 片段多时导出按钮会滚出视野：下一步跟着人走。 */}
    {away && !exportOpen && !watching && !playing && <div className="director-next-bar" role="status">
      {exporting ? <span>第 {ep.no} 集导出中</span>
        : finished ? <><span>第 {ep.no} 集已导出</span><button type="button" className="ip-brand-button" disabled={!!downloading} onClick={() => download(finished)}><Download size={14}/>{downloading === finished.id ? "正在准备下载" : "下载成片"}</button></>
        : missing.length ? <><span>{missing.length} 段还没有视频</span><button type="button" className="ip-brand-secondary" onClick={goToClip}>去生成视频</button></>
        : generating.length ? <span>{generating.length} 段视频生成中，完成后可以导出</span>
        : outdated.length ? <><span>{outdated.length} 段视频需要更新，也可以直接导出</span><button type="button" className="ip-brand-secondary" onClick={goToOutdated}>查看</button><button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => setExportOpen(true)}><Film size={14}/>导出整集</button></>
        : <><span>{unconfirmed.length ? `视频都好了，${unconfirmed.length} 段待确认` : "视频都好了，可以导出"}</span><button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => setExportOpen(true)}><Film size={14}/>导出整集</button></>}
    </div>}
    {exportOpen && <ExportDialog work={work} ep={ep} clips={clips} busy={!!busy} outdated={outdated} unconfirmed={unconfirmed.length} choice={current} onChange={setChoice} onStart={() => void startExport()} onClose={() => setExportOpen(false)}/>}
    {watching && <ExportPlayer work={work} ep={ep} item={watching} downloading={downloading === watching.id} started={downloadStarted === watching.id} onDownload={() => download(watching)} onClose={() => setWatching(undefined)}/>}
    {playing && <SequencePlayer work={work} clips={clips} onClose={() => setPlaying(false)}/>}
  </div>;
}

/** 导出等待：只写真实信息（已等多久），不编进度。 */
function ExportWaiting({ since }: { since?: string | null }) {
  const waited = useElapsedSeconds(since);
  return <p className="director-output-hint" role="status">通常需要几分钟{waited ? `，已等待 ${formatLength(waited)}` : ""}。可以离开此页面，完成后在这里下载。</p>;
}

function captionNoteOf(e: DirectorExport) {
  if (!e.captionStatus) return undefined;
  return studioCaptionNote({ status: e.captionStatus, count: e.captionCount });
}

function formatLength(seconds: number) {
  const total = Math.round(seconds);
  return total < 60 ? `${total} 秒` : `${Math.floor(total / 60)} 分 ${total % 60} 秒`;
}

const QUALITIES: Array<{ value: "" | "720p" | "1080p"; label: string; note: string }> = [
  { value: "", label: "与片段一致", note: "推荐" },
  { value: "720p", label: "720P 高清", note: "文件较小" },
  { value: "1080p", label: "1080P 超清", note: "文件较大" },
];

type ExportChoice = { captions: boolean; quality: "" | "720p" | "1080p"; music?: { key: string; name: string } };

/** 默认带字幕、清晰度跟随片段；导出过就沿用上一次的设置。 */
function exportChoiceOf(last?: DirectorExport): ExportChoice {
  return { captions: last?.captions ?? true, quality: last?.quality ?? "", ...(last?.musicStorageKey ? { music: { key: last.musicStorageKey, name: last.musicName || "背景音乐" } } : {}) };
}

/** 导出前的设置：只问三件事，都有默认值，直接点「开始导出」也能得到一条带字幕的成片。 */
function ExportDialog({ work, ep, clips, busy, outdated, unconfirmed, choice, onChange, onStart, onClose }: { work: DirectorWork; ep: DirectorEpisode; clips: DirectorClip[]; busy: boolean; outdated: string[]; unconfirmed: number;
  choice: ExportChoice; onChange: (next: ExportChoice) => void; onStart: () => void; onClose: () => void }) {
  useEscape(onClose);
  const [uploading, setUploading] = useState(false);
  const [musicError, setMusicError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const lines = clips.reduce((sum, c) => sum + c.shots.reduce((n, s) => n + s.dialogue.filter(l => l.text.trim()).length, 0), 0);
  const seconds = clips.reduce((sum, c) => sum + c.durationSec, 0);
  const captionsOn = choice.captions && lines > 0;
  const pick = async (file?: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setMusicError("这个文件超过 25 MB，请换一个小一点的音乐文件。"); if (picker.current) picker.current.value = ""; return; }
    setUploading(true); setMusicError("");
    try {
      const uploaded = await DirectorApi.uploadMusic(work.id, file);
      onChange({ ...choice, music: { key: uploaded.key, name: uploaded.fileName || file.name } });
    } catch (e) { setMusicError(errorText(e)); } finally { setUploading(false); if (picker.current) picker.current.value = ""; }
  };
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-dialog director-export-dialog" role="dialog" aria-modal="true" aria-labelledby="director-export-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-export-title">导出第 {ep.no} 集</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18}/></button></header>
      <p className="director-export-summary">共 {clips.length} 段视频，约 {formatLength(seconds)}。</p>
      {unconfirmed > 0 && <p className="director-export-warning" role="status"><AlertTriangle size={14}/>还有 {unconfirmed} 段视频没有确认，开始导出后将一并确认。</p>}
      {outdated.length > 0 && <p className="director-export-warning" role="status"><AlertTriangle size={14}/>{outdated.join("、")} 的视频是按旧设置生成的，导出将使用当前版本。如需新设置，请先重新生成并采用。</p>}

      <section className="director-export-row">
        <div className="director-export-label"><strong>字幕</strong>
          <p>{!lines ? "本集没有台词，不会添加字幕。" : captionsOn ? `根据 ${lines} 句台词自动生成，显示在画面下方。导出后无法单独去除；如需去掉，改为「不添加」后重新导出，原片段不受影响。` : "这次不添加字幕。"}</p></div>
        <Switch aria-label="自动添加字幕" checkedChildren="添加" unCheckedChildren="不添加" checked={captionsOn} disabled={!lines} onChange={captions => onChange({ ...choice, captions })}/>
      </section>

      <section className="director-export-row is-column">
        <div className="director-export-label"><strong>背景音乐<small>选填</small></strong>
          <p>人物说话时，音乐会自动压低；音乐比成片短时会循环播放。支持 MP3、WAV、M4A，最大 25 MB。</p></div>
        <input ref={picker} type="file" hidden accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a" aria-label="选择背景音乐文件" onChange={e => void pick(e.target.files?.[0])}/>
        {choice.music ? <div className="director-export-music"><Music size={15}/><span title={choice.music.name}>{choice.music.name}</span>
          <SignedAudio key={choice.music.key} storageKey={choice.music.key} controls quiet/>
          <button type="button" aria-label="移除背景音乐" onClick={() => onChange({ ...choice, music: undefined })}><Trash2 size={14}/></button></div>
          : <button type="button" className="ip-brand-secondary" disabled={uploading} onClick={() => picker.current?.click()}><Upload size={14}/>{uploading ? "上传中…" : "选择音乐文件"}</button>}
        {musicError && <InlineError message={musicError}/>}
      </section>

      <section className="director-export-row is-column">
        <div className="director-export-label"><strong>清晰度</strong></div>
        <div className="director-export-options" role="radiogroup" aria-label="清晰度">
          {QUALITIES.map(q => <label key={q.value || "same"} className={choice.quality === q.value ? "is-on" : ""}>
            <input type="radio" name="director-export-quality" checked={choice.quality === q.value} onChange={() => onChange({ ...choice, quality: q.value })}/>
            <strong>{q.label}</strong><small>{q.note}</small></label>)}
        </div>
        {choice.quality === "1080p" && <p className="director-dialog-note">片段本身不够清晰时，选择 1080P 不会让画面变得更清楚。</p>}
      </section>

      <footer><span className="director-cost">导出免费</span><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={busy || uploading} onClick={onStart}><Film size={14}/>开始导出</button></footer>
    </div>
  </div>;
}

/** 看导出的成片：先确认字幕和声音，再下载。 */
function ExportPlayer({ work, ep, item, downloading, started, onDownload, onClose }: { work: DirectorWork; ep: DirectorEpisode; item: DirectorExport; downloading: boolean; started: boolean; onDownload: () => void; onClose: () => void }) {
  useEscape(onClose);
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-dialog director-player" role="dialog" aria-modal="true" aria-labelledby="director-film-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-film-title">第 {ep.no} 集成片</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={18}/></button></header>
      <div className={`director-player-stage ratio-${work.settings.aspectRatio.replace(":", "x")}`}><video src={item.url ?? undefined} controls playsInline autoPlay/></div>
      <footer>{started && !downloading && <span className="director-cost" role="status">已开始下载，可在浏览器的下载列表中查看。</span>}
        <button type="button" className="ip-brand-button" disabled={downloading} onClick={onDownload}><Download size={14}/>{downloading ? "正在准备下载" : "下载成片"}</button></footer>
    </div>
  </div>;
}

function SequencePlayer({ work, clips, onClose }: { work: DirectorWork; clips: DirectorClip[]; onClose: () => void }) {
  useEscape(onClose);
  // 页面每隔几秒刷新一次，线上的签名地址每次都不同；按版本记住第一次的地址，否则正在播的视频会被重新加载。
  const urls = useRef(new Map<string, string>());
  const playable = useMemo(() => clips.map(c => {
    const take = adopted(c.video);
    if (!take?.url) return { clip: c, url: null };
    if (!urls.current.has(take.id)) urls.current.set(take.id, take.url);
    return { clip: c, url: urls.current.get(take.id)! };
  }), [clips]);
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
      <p className="director-dialog-note">按顺序播放已采用的视频，无视频的片段跳过。导出后的成片以「导出整集」为准。</p>
      <footer>{nextIndex >= 0 ? <button type="button" className="ip-brand-secondary" onClick={next}><SkipForward size={14}/>下一段</button>
        : <span className="director-cost">{finished ? "播放完成" : "已是最后一段"}</span>}</footer>
    </div>
  </div>;
}
