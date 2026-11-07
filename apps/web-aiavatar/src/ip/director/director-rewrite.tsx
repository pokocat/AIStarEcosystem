"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import type { DirectorClip, DirectorEpisode, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import { useStudioApp } from "../studio-errors";
import { confirmDirectorAction } from "./director-antd";
import { InlineError, chooseDirectorBilling, clearDrafts, costText, dialogFocus, failed, hasDrafts, newRequestId, runningTask, useBusy, useEscape, type DirectorFail } from "./director-shared";

// 分镜脚本 = 每个片段的镜头（还有标题、摘要、关联资产）；分镜图提示词和视频提示词由镜头自动编出来。
// 所以「重新生成提示词」就是让 AI 重写分镜脚本：整集或单个片段。只改文字，不生成图片和视频。
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
    if (w.plan || w.whole) return "本集正在写分镜脚本，完成后可重写";
  }
  if (runningTask(work, `reshoot:${clip.id}`)) return "此片段正在重写";
  if (clip.video.pending?.length || runningTask(work, `video:${clip.id}`)) return "视频生成中，完成后可重写";
  if (runningTask(work, `board:${clip.id}`)) return "分镜图生成中，完成后可重写";
  if (!work.videoLimits) return "暂无可用视频模型，无法确定片段时长";
  if (editing) return "请先保存或取消镜头修改";
  return "";
}

const hasMedia = (c: DirectorClip) => c.board.candidates.length > 0 || c.video.candidates.length > 0 || !!c.video.pending?.length;
const names = (clips: DirectorClip[]) => clips.map(c => `片段 ${c.order}`).join("、");

/** 会被替换掉的用户内容：手改过的提示词、还没保存的修改。 */
function replaced(work: DirectorWork, clips: DirectorClip[]) {
  const out: string[] = [];
  const video = clips.filter(c => c.videoPromptCustom), board = clips.filter(c => c.boardPromptCustom);
  if (video.length) out.push(`${names(video)} 手动修改过的视频提示词将被替换`);
  if (board.length) out.push(`${names(board)} 手动修改过的分镜图提示词将被替换`);
  const unsaved = clips.filter(c => hasDrafts(`${work.id}:clip:${c.id}:`));
  if (unsaved.length) out.push(`${names(unsaved)} 有未保存的修改，开始重写后将丢失`);
  return out;
}

/** 单个片段：确认后只重写这一段。 */
export function useRewriteClip(work: DirectorWork, apply: (w: DirectorWork) => void, setError: DirectorFail) {
  const { modal } = useStudioApp();
  const { busy, run } = useBusy();
  const open = (clip: DirectorClip) => {
    const lost = replaced(work, [clip]);
    confirmDirectorAction(modal, {
      title: `重写片段 ${clip.order} 的分镜脚本？`,
      content: <ul className="director-regen-notes">
        <li>AI 按本集正文重写此片段的镜头和提示词，位置和剧情不变。</li>
        <li>只修改此片段的文字，不生成图片和视频，其他片段不变。</li>
        {hasMedia(clip) && <li>已有的分镜图和视频保留在历史版本中，将标记为「需更新」。</li>}
        {lost.map(t => <li key={t} className="is-warn">{t}</li>)}
        <li>{work.pricing.mock ? costText(0, true) : "按实际用量结算"}</li>
      </ul>,
      okText: "开始重写", cancelText: "取消",
    }, () => void run(clip.id, async () => {
      const billing = await chooseDirectorBilling("storyboard");
      const ep = clip.episodeId;
      const next = await DirectorApi.runTask(work.id, { type: "reshoot", targetId: ep, options: { clipIds: [clip.id] }, clientRequestId: newRequestId(), billing, maxCost: work.pricing.textMax });
      clearDrafts(`${work.id}:clip:${clip.id}:`);
      apply(next);
    }, failed(setError, `重写片段 ${clip.order} 的分镜脚本`)));
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
      <p className="director-dialog-note">AI 按本集正文重写镜头和提示词，不生成图片和视频，其他集不受影响。</p>
      <div className="director-field" role="radiogroup" aria-label="重写方式">
        <span>重写方式</span>
        <label className="director-check">
          <input type="radio" name="director-rewrite-mode" checked={mode === "keep"} onChange={() => setMode("keep")}/>
          <span><b>保留现有 {clips.length} 个片段，逐段重写</b>
            <small>片段的数量和顺序不变，每段重写镜头。{withMedia.length ? "已有的分镜图和视频保留在历史版本中，将标记为「需更新」。" : ""}</small></span>
        </label>
        <label className={`director-check ${withMedia.length ? "is-disabled" : ""}`}>
          <input type="radio" name="director-rewrite-mode" checked={mode === "resplit"} disabled={withMedia.length > 0} onChange={() => setMode("resplit")}/>
          <span><b>重新切分片段</b>
            <small>{withMedia.length ? `${names(withMedia)} 已有分镜图或视频，重新切分会丢失这些内容，暂不可选。如需重新切分，请先删除这些片段。`
              : "片段的数量和时长可能变化，现有片段将全部替换。"}</small></span>
        </label>
      </div>
      <ul className="director-regen-notes">
        <li>现有镜头将被替换，包括你在「编辑镜头」中修改过的内容。</li>
        {lost.map(t => <li key={t} className="is-warn">{t}</li>)}
        <li>{work.pricing.mock ? costText(0, true) : "按实际用量结算"}。完成后自动显示，关闭页面不影响进行。</li>
      </ul>
      <InlineError message={error}/>
      <footer>
        <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>
        <button type="button" className="ip-brand-button" disabled={!!busy} onClick={go}><RefreshCw size={14}/>{busy ? "提交中" : "开始重写"}</button>
      </footer>
    </div>
  </div>;
}
