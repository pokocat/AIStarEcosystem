"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import type { DirectorClip, DirectorEpisode, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { useStudioApp } from "../studio-errors";
import { InlineError, chooseDirectorBilling, clearDrafts, costText, dialogFocus, failed, hasDrafts, newRequestId, runningTask, useBusy, useEscape, type DirectorFail } from "./director-shared";

// 分镜脚本 = 每个片段的镜头（还有标题、摘要、关联资产）；分镜图提示词和视频提示词由镜头自动编出来。
// 所以「重新生成提示词」就是让 AI 重写分镜脚本：整集或单个片段。只改文字，不出图、不生成视频。
// 文字任务只说「按实际用量结算」，不展示冻结上限之类不确定的积分数字（BUSINESS_RULES 文字计费一节）；maxCost 照常带给服务端核对。

/** 这一集正在写 / 重写的分镜脚本任务：整集写（plan）、整集重写，或其中某个片段在重写。 */
export function shotWriting(work: DirectorWork, ep: DirectorEpisode) {
  const plan = runningTask(work, `plan:${ep.id}`);
  const whole = runningTask(work, `reshoot:${ep.id}`);
  const clipIds = work.clips.filter(c => c.episodeId === ep.id).map(c => c.id);
  const clips = clipIds.map(id => runningTask(work, `reshoot:${id}`)).filter(t => !!t);
  return { plan, whole, clips, any: plan ?? whole ?? clips[0] };
}

/** 片段能不能单独重写；能就返回空串。 */
export function clipRewriteBlock(work: DirectorWork, clip: DirectorClip, editing: boolean) {
  const ep = work.episodes.find(e => e.id === clip.episodeId);
  if (ep) {
    const w = shotWriting(work, ep);
    if (w.plan || w.whole) return "本集正在写分镜脚本，完成后再重写";
  }
  if (runningTask(work, `reshoot:${clip.id}`)) return "这一段正在重写";
  if (clip.video.pending?.length || runningTask(work, `video:${clip.id}`)) return "视频生成中，完成后再重写";
  if (runningTask(work, `board:${clip.id}`)) return "分镜图生成中，完成后再重写";
  if (!work.videoLimits) return "暂无可用视频模型，无法确定片段时长";
  if (editing) return "先保存或取消镜头修改";
  return "";
}

const hasMedia = (c: DirectorClip) => c.board.candidates.length > 0 || c.video.candidates.length > 0 || !!c.video.pending?.length;
const names = (clips: DirectorClip[]) => clips.map(c => `片段 ${c.order}`).join("、");

/** 会被替换掉的用户内容：手改过的提示词、还没保存的修改。 */
function replaced(work: DirectorWork, clips: DirectorClip[]) {
  const out: string[] = [];
  const video = clips.filter(c => c.videoPromptCustom), board = clips.filter(c => c.boardPromptCustom);
  if (video.length) out.push(`${names(video)} 手改过的视频提示词会换成新写的`);
  if (board.length) out.push(`${names(board)} 手改过的分镜图提示词会换成新写的`);
  const unsaved = clips.filter(c => hasDrafts(`${work.id}:clip:${c.id}:`));
  if (unsaved.length) out.push(`${names(unsaved)} 还有没保存的修改，开始重写后会丢掉`);
  return out;
}

/** 单个片段：确认后只重写这一段。 */
export function useRewriteClip(work: DirectorWork, apply: (w: DirectorWork) => void, setError: DirectorFail) {
  const { modal } = useStudioApp();
  const { busy, run } = useBusy();
  const open = (clip: DirectorClip) => {
    const lost = replaced(work, [clip]);
    modal.confirm({
      title: `重写片段 ${clip.order} 的分镜脚本？`,
      content: <ul className="director-regen-notes">
        <li>AI 按本集正文重写这一段的镜头，分镜图提示词和视频提示词跟着更新；这一段在本集里的位置和讲的剧情不变。</li>
        <li>只改这一段的文字，不会出图、不会生成视频，其他片段不变。</li>
        {hasMedia(clip) && <li>已有的分镜图和视频留在历史版本里，会标成「需更新」，要不要重新生成由你决定。</li>}
        {lost.map(t => <li key={t} className="is-warn">{t}</li>)}
        <li>{work.pricing.mock ? costText(0, true) : "按实际用量结算"}</li>
      </ul>,
      okText: "开始重写", cancelText: "取消",
      onOk: () => run(clip.id, async () => {
        const billing = await chooseDirectorBilling("storyboard");
        const ep = clip.episodeId;
        const next = await DirectorApi.runTask(work.id, { type: "reshoot", targetId: ep, options: { clipIds: [clip.id] }, clientRequestId: newRequestId(), billing, maxCost: work.pricing.textMax });
        clearDrafts(`${work.id}:clip:${clip.id}:`);
        apply(next);
      }, failed(setError, `重写片段 ${clip.order} 的分镜脚本`)),
    });
  };
  return { open, busy };
}

/** 分镜页工具栏的「重写分镜脚本」：先说清改什么、不改什么、哪些手改的内容会被替换，再选怎么重写。 */
export function RewriteEpisodeDialog({ work, ep, apply, onClose }: { work: DirectorWork; ep: DirectorEpisode; apply: (w: DirectorWork) => void; onClose: () => void }) {
  const clips = work.clips.filter(c => c.episodeId === ep.id).sort((a, b) => a.order - b.order);
  const withMedia = clips.filter(hasMedia);
  const [mode, setMode] = useState<"keep" | "resplit">("keep");
  const [error, setLocalError] = useState("");
  const { busy, run } = useBusy();
  useEscape(() => { if (!busy) onClose(); });
  const lost = replaced(work, clips);
  const go = () => void run("rewrite", async () => {
    const billing = await chooseDirectorBilling("storyboard");
    const next = mode === "keep"
      ? await DirectorApi.runTask(work.id, { type: "reshoot", targetId: ep.id, clientRequestId: newRequestId(), billing, maxCost: work.pricing.textMax })
      : await DirectorApi.runTask(work.id, { type: "plan", targetId: ep.id, clientRequestId: newRequestId(), billing, maxCost: work.pricing.textMax });
    for (const c of clips) clearDrafts(`${work.id}:clip:${c.id}:`);
    apply(next);
    onClose();
  }, setLocalError);
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
    <div className="director-dialog director-rewrite-dialog" role="dialog" aria-modal="true" aria-labelledby="director-rewrite-title" ref={dialogFocus} tabIndex={-1}>
      <header><h2 id="director-rewrite-title">重写第 {ep.no} 集分镜脚本</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={!!busy}><X size={18}/></button></header>
      <p className="director-dialog-note">AI 按本集正文重新写镜头，每个片段的分镜图提示词和视频提示词跟着更新。只改文字，不会出图、不会生成视频，其他集不受影响。只想换某一段，关掉这里，在那个片段上点「重写」。</p>
      <div className="director-field" role="radiogroup" aria-label="怎么重写">
        <span>怎么重写</span>
        <label className="director-check">
          <input type="radio" name="director-rewrite-mode" checked={mode === "keep"} onChange={() => setMode("keep")}/>
          <span><b>保留现有 {clips.length} 个片段，逐段重写</b>
            <small>片段的数量和顺序不变，每段换一套新镜头。{withMedia.length ? "已有的分镜图和视频留在历史版本里，会标成「需更新」，要不要重新生成由你决定。" : ""}</small></span>
        </label>
        <label className={`director-check ${withMedia.length ? "is-disabled" : ""}`}>
          <input type="radio" name="director-rewrite-mode" checked={mode === "resplit"} disabled={withMedia.length > 0} onChange={() => setMode("resplit")}/>
          <span><b>重新切分片段</b>
            <small>{withMedia.length ? `${names(withMedia)} 已有分镜图或视频，重新切分会丢掉它们，所以现在不能选。要重新切分，先删除这些片段。`
              : "片段的数量和时长可能变化，现有片段全部换成新写的。"}</small></span>
        </label>
      </div>
      <ul className="director-regen-notes">
        <li>现有镜头会换成新写的，包括你在「编辑镜头」里改过的内容。</li>
        {lost.map(t => <li key={t} className="is-warn">{t}</li>)}
        <li>{work.pricing.mock ? costText(0, true) : "按实际用量结算"}。写好后自动显示，关掉页面也不中断。</li>
      </ul>
      <InlineError message={error}/>
      <footer>
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy} onClick={go}><RefreshCw size={14}/>{busy ? "提交中" : "开始重写"}</button>
      </footer>
    </div>
  </div>;
}
