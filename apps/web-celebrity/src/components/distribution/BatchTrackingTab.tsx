"use client";

// v0.22: 分发中心「任务追踪」按 projectId 聚合的批次列表。
//
// 替代 DistributionPage 里直接渲染 <PublishJobList />。当用户每天跑几十批 N×M
// 任务后，按批次聚合 + 服务端分页 + 一键批量操作 / 重新调度，避免数据爆炸。
//
// 行为：
//   - 启动 fetch listBatches({page:0,limit:20})
//   - 列表里任一 batch hasInflight=true → 每 5s 自适应轮询
//   - 用户点 [详情▶] → 打开 BatchDetailDrawer（嵌 PublishJobList 显示子任务）
//   - 用户点 [取消整批]/[重试失败] → 直接调对应 API + 触发 list refetch
//   - 用户点 [重新调度] → 打开 RescheduleBatchDialog；提交后 refetch

import * as React from "react";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { ApiError, PublishJobApi } from "@ai-star-eco/api-client";
import type { PublishBatchSummary } from "@ai-star-eco/types/publish-job";
import type { PaginatedResponse } from "@ai-star-eco/types/_shared";
import { CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { BatchSummaryCard } from "./BatchSummaryCard";
import { BatchDetailDrawer } from "./BatchDetailDrawer";
import { RescheduleBatchDialog } from "./RescheduleBatchDialog";

const PAGE_LIMIT = 20;
const POLL_INTERVAL_MS = 5_000;

type BusyAction = "cancel" | "retry" | "reschedule";

export function BatchTrackingTab() {
  const [page, setPage] = React.useState(0);
  const [resp, setResp] = React.useState<PaginatedResponse<PublishBatchSummary> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 单点互斥：同一时刻只允许 N 张卡里的 1 个 batch 跑 mutation
  const [busy, setBusy] = React.useState<{ projectId: string; action: BusyAction } | null>(null);
  // 单点 mutation 报错（取消整批 / 重试失败的 inline error）
  const [actionError, setActionError] = React.useState<string | null>(null);

  // 详情 Drawer 选中的 batch
  const [selectedDetail, setSelectedDetail] = React.useState<PublishBatchSummary | null>(null);
  // 重新调度 Dialog 选中的 batch
  const [rescheduleTarget, setRescheduleTarget] = React.useState<PublishBatchSummary | null>(null);

  const refresh = React.useCallback(
    async (opts: { silent?: boolean; nextPage?: number } = {}) => {
      const targetPage = opts.nextPage ?? page;
      if (!opts.silent) setRefreshing(true);
      try {
        const r = await PublishJobApi.listBatches({ page: targetPage, limit: PAGE_LIMIT });
        setResp(r);
        setError(null);
      } catch (e) {
        if (!opts.silent) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!opts.silent) setRefreshing(false);
        setLoading(false);
      }
    },
    [page],
  );

  // 首拉 / page 变化时重拉
  React.useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // 自适应轮询：列表上有任一 hasInflight=true → 5s 重拉
  React.useEffect(() => {
    if (!resp) return;
    const hasInflight = resp.data.some((b) => b.hasInflight);
    if (!hasInflight) return;
    const id = window.setInterval(() => {
      void refresh({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [resp, refresh]);

  const runBatchAction = async (
    batch: PublishBatchSummary,
    action: BusyAction,
    impl: () => Promise<unknown>,
  ) => {
    if (busy !== null) return;
    setBusy({ projectId: batch.projectId, action });
    setActionError(null);
    try {
      await impl();
      // 成功后立即重拉列表
      await refresh({ silent: true });
      // 如果当前详情 drawer 是这个 batch，更新它的最新 summary
      if (selectedDetail?.projectId === batch.projectId) {
        try {
          const updated = await PublishJobApi.getBatch(batch.projectId);
          setSelectedDetail(updated);
        } catch {
          /* drawer summary 刷新失败不阻塞主流程 */
        }
      }
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = (batch: PublishBatchSummary) => {
    if (!window.confirm(`确认取消「${batch.displayTitle}」批次里所有未完成的任务？\n已上线 / 已失败的任务不受影响。`)) {
      return;
    }
    void runBatchAction(batch, "cancel", () => PublishJobApi.cancelBatch(batch.projectId));
  };
  const handleRetry = (batch: PublishBatchSummary) => {
    const failed = batch.statusCounts.failed ?? 0;
    if (!window.confirm(`重试「${batch.displayTitle}」批次里 ${failed} 个失败任务？\n每条会重新走扣费流程。`)) {
      return;
    }
    void runBatchAction(batch, "retry", () => PublishJobApi.retryFailedBatch(batch.projectId));
  };
  const handleReschedule = (batch: PublishBatchSummary) => {
    setRescheduleTarget(batch);
  };

  const content = resp?.data ?? [];
  const totalPages = resp?.pagination?.totalPages ?? 1;
  const total = resp?.pagination?.total ?? 0;
  const hasNext = resp?.pagination?.hasNext ?? false;
  const hasPrev = resp?.pagination?.hasPrev ?? false;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-zinc-500">
          {loading
            ? "加载中…"
            : total > 0
              ? `共 ${total} 个批次 · 第 ${page + 1} / ${totalPages} 页`
              : "暂无批次"}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className={cn(CTA_SECONDARY, "px-2.5 py-1.5 text-xs", refreshing && "cursor-wait opacity-70")}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          {refreshing ? "刷新中…" : "刷新"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin mr-2" />
          加载中……
        </div>
      ) : content.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center">
          <p className="text-sm text-zinc-600">还没有分发任务</p>
          <p className="text-xs text-zinc-400 mt-1">
            去工作台挑选已生成的视频开始分发，或者用上传链接分发外部视频。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {content.map((batch) => (
            <BatchSummaryCard
              key={batch.projectId}
              batch={batch}
              busyAction={busy?.projectId === batch.projectId ? busy.action : null}
              onOpenDetail={() => setSelectedDetail(batch)}
              onCancelBatch={() => handleCancel(batch)}
              onRetryFailed={() => handleRetry(batch)}
              onReschedule={() => handleReschedule(batch)}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <footer className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={!hasPrev || refreshing}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className={cn(CTA_SECONDARY, "px-2.5 py-1.5 text-xs", (!hasPrev || refreshing) && "opacity-50")}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            上一页
          </button>
          <span className="text-[11px] text-zinc-500 tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!hasNext || refreshing}
            onClick={() => setPage((p) => p + 1)}
            className={cn(CTA_SECONDARY, "px-2.5 py-1.5 text-xs", (!hasNext || refreshing) && "opacity-50")}
          >
            下一页
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </footer>
      )}

      <BatchDetailDrawer
        open={selectedDetail !== null}
        onClose={() => setSelectedDetail(null)}
        batch={selectedDetail}
      />
      <RescheduleBatchDialog
        open={rescheduleTarget !== null}
        onClose={() => setRescheduleTarget(null)}
        projectId={rescheduleTarget?.projectId ?? ""}
        queuedCount={rescheduleTarget?.statusCounts.queued ?? 0}
        onRescheduled={() => {
          void refresh({ silent: true });
        }}
      />
    </section>
  );
}
