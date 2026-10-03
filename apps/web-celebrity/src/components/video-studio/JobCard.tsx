"use client";

// 一条生成记录：状态、模式、规格、提交时间、提示词（两行截断，全文放 title）、输入素材缩略图、
// 进度 / 成片播放器 + 下载 / 失败原因（服务端原话）、积分（冻结 / 消耗 / 已退回）。
//
// 成片与素材都是有时效的签名地址：加载失败时找服务端换一份新地址（每张卡最多换两次，
// 免得坏文件无限重试）。演示模式没有真实成片，明确标出来，不放一个打不开的播放器（§8.0）。
// 成功的那条可以「存为模板」（docs/video-studio-plan.md §10）；用过智能优化 / 做同款的各有一个小标。

import * as React from "react";
import { BookmarkPlus, CheckCircle2, Clock, Coins, Download, Loader2, TriangleAlert } from "lucide-react";
import type { VideoStudioJob, VideoStudioJobStatus } from "@ai-star-eco/types/video-studio";
import { formatCredits, formatDateTime } from "@ai-star-eco/api-client/format";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { USE_MOCK } from "@/api/_client";
import { AiErrorNotice } from "@/components/common/ai-error-notice";
import {
  VIDEO_STUDIO_MODE_LABEL,
  aspectValue,
  isJobActive,
  jobCreditsText,
  jobSpecText,
  jobStatusText,
} from "@/constants/video-studio-ui";
import { MediaThumb } from "./MediaThumb";
import { useStableUrl } from "./use-stable-url";

const STATUS_STYLE: Record<VideoStudioJobStatus, { className: string; Icon: typeof Clock; spin?: boolean }> = {
  queued: { className: "bg-zinc-100 text-zinc-600", Icon: Clock },
  running: { className: "bg-violet-50 text-violet-700", Icon: Loader2, spin: true },
  succeeded: { className: "bg-emerald-50 text-emerald-600", Icon: CheckCircle2 },
  failed: { className: "bg-rose-50 text-rose-600", Icon: TriangleAlert },
};

const MAX_URL_REFRESHES = 2;
const PLAYER_MAX_HEIGHT = 360;

export function JobCard({
  job,
  onMediaExpired,
  onSaveTemplate,
}: {
  job: VideoStudioJob;
  onMediaExpired: (id: string) => void;
  /** 「存为模板」：只有成功的那条有。 */
  onSaveTemplate: (job: VideoStudioJob) => void;
}) {
  const status = STATUS_STYLE[job.status] ?? STATUS_STYLE.queued;
  const modeLabel = VIDEO_STUDIO_MODE_LABEL[job.mode] ?? "视频生成";
  const refreshes = React.useRef(0);
  const expired = React.useCallback(() => {
    if (refreshes.current >= MAX_URL_REFRESHES) return;
    refreshes.current += 1;
    onMediaExpired(job.id);
  }, [job.id, onMediaExpired]);

  const specTitle = [
    jobSpecText(job),
    job.width && job.height ? `${job.width}×${job.height}` : null,
    job.seed != null ? `随机种子 ${job.seed}` : null,
    job.modelName ? `模型 ${job.modelName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const created = formatDateTime(job.createdAt);
  const completed = job.completedAt ? formatDateTime(job.completedAt) : null;
  const pct = Math.max(0, Math.min(100, Math.round(job.progressPct)));

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
      <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular-nums",
            status.className,
          )}
        >
          <status.Icon className={cn("h-3 w-3", status.spin && "animate-spin")} />
          {jobStatusText(job)}
        </span>
        <span className="min-w-0 truncate text-[13px] font-semibold text-zinc-800" title={modeLabel}>
          {modeLabel}
        </span>
        {job.originalPrompt ? (
          <span
            className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-600"
            title={`用了智能优化。原提示词：${job.originalPrompt}`}
          >
            智能优化
          </span>
        ) : null}
        {job.templateId ? (
          <span
            className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-600"
            title="这条是用模板做同款生成的"
          >
            做同款
          </span>
        ) : null}
        {USE_MOCK ? (
          <span
            className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-medium text-amber-700"
            title="演示数据，没有真的调用视频模型"
          >
            演示
          </span>
        ) : null}
        <span
          className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-zinc-500"
          title={completed ? `提交于 ${created}，完成于 ${completed}` : `提交于 ${created}`}
        >
          {created}
        </span>
      </header>

      <div className="truncate font-mono text-[11px] tabular-nums text-zinc-500" title={specTitle}>
        {jobSpecText(job)}
        {job.seed != null ? ` · 种子 ${job.seed}` : ""}
        {job.modelName ? ` · ${job.modelName}` : ""}
      </div>

      <p className="line-clamp-2 break-words text-[13px] leading-relaxed text-zinc-700" title={job.prompt}>
        {job.prompt}
      </p>

      {job.inputs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="输入素材">
          {job.inputs.map((input, i) => (
            <MediaThumb key={`${input.label}-${i}`} input={input} onExpired={expired} />
          ))}
        </div>
      ) : null}

      {isJobActive(job.status) ? (
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="生成进度"
          >
            <div className="h-full rounded-full bg-violet-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="max-w-[50%] shrink-0 truncate text-[11px] text-zinc-500" title={job.stage}>
            {job.stage}
          </span>
        </div>
      ) : null}

      {job.status === "succeeded" ? (
        job.videoUrl ? (
          <ResultVideo job={job} videoUrl={job.videoUrl} onExpired={expired} />
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-center text-[12px] leading-relaxed text-zinc-500">
            {USE_MOCK ? "演示模式不出真实成片" : "成片地址暂时取不到，稍后点「刷新」再试"}
          </div>
        )
      ) : null}

      {job.status === "failed" ? <AiErrorNotice title="生成失败" message={job.errorMessage || "生成失败"} /> : null}

      {job.credits > 0 || job.status === "succeeded" ? (
        <footer className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-zinc-100 pt-2.5 text-[11.5px] text-zinc-500">
          {job.credits > 0 ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Coins className="h-3 w-3 shrink-0" />
              {jobCreditsText(job.status, formatCredits(job.credits))}
            </span>
          ) : null}
          {job.status === "succeeded" ? (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSaveTemplate(job)}
                title="记下这条的模式、提示词、规格和素材，之后可以直接做同款"
                className="mobile-touch-target inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 font-medium text-zinc-700 hover:border-violet-400 hover:text-violet-600"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                存为模板
              </button>
              {job.videoUrl ? (
                <a
                  href={job.videoUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="mobile-touch-target inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 font-medium text-zinc-700 hover:border-violet-400 hover:text-violet-600"
                >
                  <Download className="h-3.5 w-3.5" />
                  下载
                </a>
              ) : null}
            </span>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

function ResultVideo({ job, videoUrl, onExpired }: { job: VideoStudioJob; videoUrl: string; onExpired: () => void }) {
  const [src, markBroken] = useStableUrl(videoUrl);
  const [poster] = useStableUrl(job.thumbnailUrl);
  const ratio = job.width && job.height ? job.width / job.height : (aspectValue(job.aspectRatio) ?? 9 / 16);
  // 宽度取「卡片宽」与「按 360px 高换算的宽」中小的那个，高度随比例走：
  // 竖屏不会把整列撑满，横屏不会超过 360px 高，窄屏上也不会出现黑边
  const style: React.CSSProperties = {
    width: `min(100%, ${Math.round(PLAYER_MAX_HEIGHT * ratio)}px)`,
    height: "auto",
    aspectRatio: String(ratio),
  };
  return (
    <div className="flex max-w-[640px] justify-center rounded-xl bg-zinc-100 p-1.5">
      <video
        src={src ?? undefined}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        className="block rounded-lg bg-black"
        style={style}
        onError={() => {
          markBroken();
          onExpired();
        }}
      />
    </div>
  );
}
