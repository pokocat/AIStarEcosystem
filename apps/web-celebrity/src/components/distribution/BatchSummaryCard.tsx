"use client";

// v0.22: 任务追踪「批次摘要卡片」。一张卡片 = 一个 projectId 下的所有 PublishJob 汇总。
//   - 顶部行：source 徽章 + displayTitle + lastCreatedAt 相对时间
//   - 中间行：progressPct 进度条 + 8 个状态 chip（仅 count>0 的显示）
//   - 调度行：firstScheduledAt → lastScheduledAt 区间 + 平台列表
//   - 底排：取消整批 / 重试失败 / 重新调度 / 详情▶
//
// 按钮可用性根据 statusCounts 派生：取消要求有 inflight + queued；
// 重试失败要求 failed>0；重新调度要求 queued>0。

import * as React from "react";
import { Loader2, ChevronRight, X, RotateCw, CalendarClock } from "lucide-react";
import type { PublishBatchSummary, PublishJobStatus } from "@ai-star-eco/types/publish-job";
import { CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  batch: PublishBatchSummary;
  /** "[详情▶]" 点击 → 父级打开 Drawer */
  onOpenDetail: () => void;
  onCancelBatch: () => void;
  onRetryFailed: () => void;
  onReschedule: () => void;
  /** 三个 mutation 中是否正在执行（来自父级管控；同一时刻只允许一个 mutation） */
  busyAction: "cancel" | "retry" | "reschedule" | null;
}

const SOURCE_BADGE: Record<PublishBatchSummary["source"], { label: string; cls: string; icon: string }> = {
  mixcut: { label: "混剪批次", cls: "bg-violet-50 text-violet-700 border-violet-200", icon: "📦" },
  manual: { label: "手动分发", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: "📩" },
  other:  { label: "历史散件", cls: "bg-zinc-50 text-zinc-500 border-zinc-200", icon: "🗂" },
};

const STATUS_CHIP_META: Record<PublishJobStatus, { label: string; cls: string }> = {
  queued:        { label: "等待",     cls: "bg-zinc-100 text-zinc-700" },
  uploading:     { label: "上传",     cls: "bg-violet-100 text-violet-700" },
  transcoding:   { label: "处理",     cls: "bg-indigo-100 text-indigo-700" },
  publishing:    { label: "发布",     cls: "bg-sky-100 text-sky-700" },
  awaiting_user: { label: "需验证",   cls: "bg-amber-100 text-amber-700" },
  live:          { label: "已发布",   cls: "bg-emerald-100 text-emerald-700" },
  failed:        { label: "未成功",   cls: "bg-rose-100 text-rose-700" },
  cancelled:     { label: "已取消",   cls: "bg-zinc-100 text-zinc-500" },
};

const PLATFORM_LABEL: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xiaohongshu: "小红书",
  shipinhao: "视频号",
};

export function BatchSummaryCard({
  batch,
  onOpenDetail,
  onCancelBatch,
  onRetryFailed,
  onReschedule,
  busyAction,
}: Props) {
  const badge = SOURCE_BADGE[batch.source];
  const queuedCount = batch.statusCounts.queued ?? 0;
  const failedCount = batch.statusCounts.failed ?? 0;
  const cancelledCount = batch.statusCounts.cancelled ?? 0;
  const liveCount = batch.statusCounts.live ?? 0;

  const canCancel = batch.hasInflight || queuedCount > 0;
  const canRetryFailed = failedCount > 0;
  const canReschedule = queuedCount > 0;

  // 分段进度条比例：live=绿 / failed=红 / cancelled=灰 / inflight=透明留白。
  // 总宽度 100%，剩下的部分就是还在进行中。失败为主时整条偏红，与文案+chip 一致。
  const livePct = batch.totalJobs > 0 ? (liveCount * 100) / batch.totalJobs : 0;
  const failedPct = batch.totalJobs > 0 ? (failedCount * 100) / batch.totalJobs : 0;
  const cancelledPct = batch.totalJobs > 0 ? (cancelledCount * 100) / batch.totalJobs : 0;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)] hover:shadow-md transition-shadow">
      {/* 顶行：徽章 + 标题 + lastCreatedAt */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
              badge.cls,
            )}
          >
            <span aria-hidden>{badge.icon}</span>
            {badge.label}
          </span>
          <h3 className="text-sm font-semibold text-zinc-800 truncate" title={batch.displayTitle}>
            {batch.displayTitle}
          </h3>
        </div>
        <span
          className="text-[11px] text-zinc-400 font-mono shrink-0"
          title={new Date(batch.lastCreatedAt).toLocaleString()}
        >
          {formatRelative(batch.lastCreatedAt)}
        </span>
      </header>

      {/* 进度条：分段着色，按 live(绿)/failed(红)/cancelled(灰)/inflight(留白) 显示真实分布 */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-zinc-600">
            {liveCount}/{batch.totalJobs} 已发布
            {failedCount > 0 && <span className="text-rose-600 ml-1">· {failedCount} 未成功</span>}
          </span>
          <span className="text-[11px] text-zinc-500 tabular-nums">完成 {batch.progressPct}%</span>
        </div>
        <div
          className="mt-1 flex h-1.5 rounded-full bg-zinc-100 overflow-hidden"
          aria-hidden
        >
          {livePct > 0 && (
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${livePct}%` }} />
          )}
          {failedPct > 0 && (
            <div className="h-full bg-rose-400 transition-all" style={{ width: `${failedPct}%` }} />
          )}
          {cancelledPct > 0 && (
            <div className="h-full bg-zinc-300 transition-all" style={{ width: `${cancelledPct}%` }} />
          )}
        </div>
      </div>

      {/* 状态 chip 矩阵：只显示 count>0 的 */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(Object.entries(batch.statusCounts) as [PublishJobStatus, number][])
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([s, n]) => (
            <span
              key={s}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                STATUS_CHIP_META[s].cls,
              )}
            >
              {STATUS_CHIP_META[s].label}
              <span className="tabular-nums">{n}</span>
            </span>
          ))}
      </div>

      {/* 平台 + 发布时间 */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-500">
        <div>
          <span className="text-zinc-400">平台：</span>
          {batch.platforms.length > 0
            ? batch.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(" · ")
            : "—"}
        </div>
        <div className="flex items-center gap-1">
          <CalendarClock className="size-3 text-zinc-400" />
          <span className="text-zinc-400">发布时间：</span>
          {formatScheduleRange(batch.firstScheduledAt, batch.lastScheduledAt)}
        </div>
      </div>

      {/* 底排按钮 */}
      <footer className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className={cn(CTA_SECONDARY, "text-xs px-2.5 py-1.5")}
          disabled={!canCancel || busyAction !== null}
          onClick={onCancelBatch}
          title={canCancel ? "取消所有未完成的任务" : "这个批次没有可取消的任务"}
        >
          {busyAction === "cancel" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          全部取消
        </button>
        <button
          type="button"
          className={cn(CTA_SECONDARY, "text-xs px-2.5 py-1.5")}
          disabled={!canRetryFailed || busyAction !== null}
          onClick={onRetryFailed}
          title={canRetryFailed ? `重试 ${failedCount} 条未成功的任务` : "这个批次没有未成功的任务"}
        >
          {busyAction === "retry" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          重试 {canRetryFailed ? `(${failedCount})` : ""}
        </button>
        <button
          type="button"
          className={cn(CTA_SECONDARY, "text-xs px-2.5 py-1.5")}
          disabled={!canReschedule || busyAction !== null}
          onClick={onReschedule}
          title={canReschedule ? `重新安排 ${queuedCount} 条还未开始的任务` : "这个批次没有可重新安排的任务"}
        >
          {busyAction === "reschedule" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CalendarClock className="h-3.5 w-3.5" />
          )}
          改时间
        </button>
        <button
          type="button"
          className={cn(CTA_SECONDARY, "text-xs px-2.5 py-1.5 hover:border-violet-300 hover:text-violet-700")}
          onClick={onOpenDetail}
        >
          详情
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </article>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return d.toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return d.toLocaleDateString();
}

function formatScheduleRange(first: string | null, last: string | null): string {
  if (!first || !last) return "立即";
  const fd = new Date(first);
  const ld = new Date(last);
  // 同分钟 → 视为单点；只显示一个时间
  if (Math.abs(ld.getTime() - fd.getTime()) < 60_000) return formatShort(fd);
  return `${formatShort(fd)} → ${formatShort(ld)}`;
}

function formatShort(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const dateStr = sameYear
    ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${dateStr} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
