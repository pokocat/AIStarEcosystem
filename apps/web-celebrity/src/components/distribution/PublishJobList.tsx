"use client";

// 当前用户分发任务列表 + 行操作（开始 / 取消 / 重试）。
//
// 进度展示：依赖 PublishJob.progress（0-100）和 status；server 接到 sau-service
// 回调即更新 DB，前端轮询 GET /me/publish-jobs 拉最新。

import * as React from "react";
import { Play, X, RotateCw, ExternalLink, RefreshCw } from "lucide-react";
import { PublishJobApi } from "@ai-star-eco/api-client";
import type { PublishJob, PublishJobStatus } from "@ai-star-eco/types/publish-job";
import { CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

const STATUS_META: Record<PublishJobStatus, { label: string; cls: string; bar: string }> = {
  queued:      { label: "排队中",   cls: "bg-zinc-50 text-zinc-600 border-zinc-200",       bar: "bg-zinc-300" },
  uploading:   { label: "上传中",   cls: "bg-violet-50 text-violet-700 border-violet-200", bar: "bg-violet-400" },
  transcoding: { label: "转码中",   cls: "bg-indigo-50 text-indigo-700 border-indigo-200", bar: "bg-indigo-400" },
  publishing:  { label: "发布中",   cls: "bg-sky-50 text-sky-700 border-sky-200",          bar: "bg-sky-400" },
  live:        { label: "已上线",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-400" },
  failed:      { label: "失败",     cls: "bg-rose-50 text-rose-700 border-rose-200",       bar: "bg-rose-400" },
  cancelled:   { label: "已取消",   cls: "bg-zinc-50 text-zinc-500 border-zinc-200",       bar: "bg-zinc-300" },
};

const PLATFORM_LABEL: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xiaohongshu: "小红书",
  shipinhao: "视频号",
};

const POLL_INTERVAL_MS = 2500;

interface Props {
  /** 限定项目；未传 = 显示用户全部任务 */
  projectId?: string;
}

export function PublishJobList({ projectId }: Props) {
  const [jobs, setJobs] = React.useState<PublishJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await PublishJobApi.listPublishJobs(projectId ? { projectId } : {});
      setJobs(list);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // poll while any job is in-flight
  React.useEffect(() => {
    const hasInflight = jobs.some(
      (j) => j.status !== "live" && j.status !== "failed" && j.status !== "cancelled",
    );
    if (!hasInflight) return;
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [jobs, refresh]);

  const handleStart = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await PublishJobApi.startPublishJob(id);
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("取消任务后将不退还已扣的积分，确定？")) return;
    setBusyId(id);
    try {
      const updated = await PublishJobApi.cancelPublishJob(id);
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await PublishJobApi.retryPublishJob(id);
      setJobs(jobs.map((j) => (j.id === id ? updated : j)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)]">
      <header className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">分发任务</h2>
          <p className="text-xs text-zinc-500">
            任务状态由 sau-service 自动推进，前端每 2.5 秒轮询同步进度。失败不退积分。
          </p>
        </div>
        <button
          type="button"
          className={cn(CTA_SECONDARY, "px-3 py-1.5 text-xs")}
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> 刷新
        </button>
      </header>

      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-400">加载中……</div>
      ) : jobs.length === 0 ? (
        <div className="py-8 text-center text-sm text-zinc-400">
          还没有分发任务。绑定一个账号后，可以从项目详情触发批量分发。
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pt-3">
          {jobs.map((j) => {
            const meta = STATUS_META[j.status];
            const platform = PLATFORM_LABEL[j.platformId] ?? j.platformName ?? j.platformId;
            return (
              <li
                key={j.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-100 p-3 transition hover:border-zinc-200"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800 truncate">
                    {j.title ?? "(未命名)"}
                  </span>
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      meta.cls,
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-zinc-500">→ {platform}</span>
                  {j.creditsSpent != null && (
                    <span className="text-[11px] text-zinc-400">
                      -{j.creditsSpent} 积分
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {j.status === "queued" && (
                      <button
                        type="button"
                        className={cn(CTA_SECONDARY, "px-2 py-1 text-xs")}
                        disabled={busyId === j.id}
                        onClick={() => handleStart(j.id)}
                      >
                        <Play className="h-3 w-3" /> 开始
                      </button>
                    )}
                    {(j.status === "queued" ||
                      j.status === "uploading" ||
                      j.status === "transcoding" ||
                      j.status === "publishing") && (
                      <button
                        type="button"
                        className={cn(CTA_SECONDARY, "px-2 py-1 text-xs hover:border-rose-300 hover:text-rose-600")}
                        disabled={busyId === j.id}
                        onClick={() => handleCancel(j.id)}
                      >
                        <X className="h-3 w-3" /> 取消
                      </button>
                    )}
                    {(j.status === "failed" || j.status === "cancelled") && (
                      <button
                        type="button"
                        className={cn(CTA_SECONDARY, "px-2 py-1 text-xs")}
                        disabled={busyId === j.id}
                        onClick={() => handleRetry(j.id)}
                      >
                        <RotateCw className="h-3 w-3" /> 重试
                      </button>
                    )}
                    {j.externalUrl && (
                      <a
                        href={j.externalUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={cn(CTA_SECONDARY, "px-2 py-1 text-xs")}
                      >
                        <ExternalLink className="h-3 w-3" /> 查看
                      </a>
                    )}
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn("h-full transition-all", meta.bar)}
                    style={{ width: `${Math.max(0, Math.min(100, j.progress))}%` }}
                  />
                </div>
                {j.errorMessage && (
                  <p className="text-xs text-rose-600">{j.errorMessage}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
