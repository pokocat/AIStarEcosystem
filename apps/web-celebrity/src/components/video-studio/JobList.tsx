"use client";

// 「视频生成」右栏「生成记录」页签：本区自己的生成记录，新的在上。
// 页签本身就是标题（VideoStudio 里的「生成记录」「模板」），这里不再放一个 h2。

import * as React from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import type { VideoStudioJob } from "@ai-star-eco/types/video-studio";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiErrorNotice } from "@/components/common/ai-error-notice";
import { JobCard } from "./JobCard";
import { VIDEO_STUDIO_POLL_MS, type VideoStudioJobsState } from "./use-video-studio-jobs";

export function JobList({
  state,
  onSaveTemplate,
}: {
  state: VideoStudioJobsState;
  /** 成功的那条点了「存为模板」。 */
  onSaveTemplate: (job: VideoStudioJob) => void;
}) {
  const { jobs, error, refreshError, refreshing, activeCount, polling, reload, refreshJob } = state;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {activeCount > 0 ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium tabular-nums text-violet-700">
            {activeCount} 条进行中
          </span>
        ) : null}
        <span className="flex-1" />
        {polling ? (
          <span className="text-[11px] text-zinc-400">每 {Math.round(VIDEO_STUDIO_POLL_MS / 1000)} 秒自动刷新</span>
        ) : null}
        <button
          type="button"
          onClick={reload}
          disabled={refreshing}
          title="重新加载生成记录"
          className="mobile-touch-target inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[12px] text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
          刷新
        </button>
      </div>

      {refreshError && jobs !== null ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">刷新失败：{refreshError}（下面的列表可能不是最新的）</span>
        </div>
      ) : null}

      {jobs === null ? (
        error ? (
          <AiErrorNotice title="生成记录没有加载出来" message={error} onRetry={reload} />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取生成记录…
          </div>
        )
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          还没有生成记录，提交之后会显示在这里。
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onMediaExpired={refreshJob} onSaveTemplate={onSaveTemplate} />
          ))}
        </div>
      )}
    </div>
  );
}
