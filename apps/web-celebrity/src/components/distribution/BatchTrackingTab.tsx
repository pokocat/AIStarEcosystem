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
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { ApiError, PublishJobApi } from "@ai-star-eco/api-client";
import type { PublishBatchSummary, PublishJob } from "@ai-star-eco/types/publish-job";
import type { PaginatedResponse } from "@ai-star-eco/types/_shared";
import { CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { BatchSummaryCard } from "./BatchSummaryCard";
import { BatchDetailDrawer } from "./BatchDetailDrawer";
import { RescheduleBatchDialog } from "./RescheduleBatchDialog";
import { useConfirm } from "@/components/common/confirm-dialog";

const PAGE_LIMIT = 20;
const POLL_INTERVAL_MS = 5_000;

type BusyAction = "cancel" | "retry" | "reschedule";
type ActionNotice = {
  tone: "success" | "warning";
  message: string;
  action?: "accounts";
};

export function BatchTrackingTab() {
  const router = useRouter();
  const [page, setPage] = React.useState(0);
  const [resp, setResp] = React.useState<PaginatedResponse<PublishBatchSummary> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 单点互斥：同一时刻只允许 N 张卡里的 1 个 batch 跑 mutation
  const [busy, setBusy] = React.useState<{ projectId: string; action: BusyAction } | null>(null);
  // 单点 mutation 报错（取消整批 / 重试失败的 inline error）
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionNotice, setActionNotice] = React.useState<ActionNotice | null>(null);

  // 详情 Drawer 选中的 batch
  const [selectedDetail, setSelectedDetail] = React.useState<PublishBatchSummary | null>(null);
  // 重新调度 Dialog 选中的 batch
  const [rescheduleTarget, setRescheduleTarget] = React.useState<PublishBatchSummary | null>(null);

  const { confirm, ConfirmHost } = useConfirm();

  const refresh = React.useCallback(
    async (opts: { silent?: boolean; nextPage?: number } = {}) => {
      const targetPage = opts.nextPage ?? page;
      if (!opts.silent) setRefreshing(true);
      try {
        const r = await PublishJobApi.listBatches({ page: targetPage, limit: PAGE_LIMIT });
        setResp(r);
        setError(null);
        if (!opts.silent) setActionNotice(null);
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
    onSuccess?: (result: unknown) => void,
  ) => {
    if (busy !== null) return;
    setBusy({ projectId: batch.projectId, action });
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await impl();
      onSuccess?.(result);
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
      setActionNotice(null);
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async (batch: PublishBatchSummary) => {
    const ok = await confirm({
      title: `取消整批：${batch.displayTitle}`,
      description: "批次里所有未完成的任务会被取消。已上线 / 已失败的任务不受影响。",
      confirmText: "取消整批",
      tone: "danger",
    });
    if (!ok) return;
    void runBatchAction(batch, "cancel", () => PublishJobApi.cancelBatch(batch.projectId));
  };
  const handleRetry = async (batch: PublishBatchSummary) => {
    const failed = batch.statusCounts.failed ?? 0;
    const ok = await confirm({
      title: `重试失败：${batch.displayTitle}`,
      description: (
        <>
          将重试该批次里的 <b>{failed}</b> 个失败任务。每条会重新走扣费流程。
        </>
      ),
      confirmText: "确认重试",
    });
    if (!ok) return;
    void runBatchAction(
      batch,
      "retry",
      () => PublishJobApi.retryFailedBatch(batch.projectId),
      (result) => {
        setActionNotice(buildRetryNotice(batch, Array.isArray(result) ? result as PublishJob[] : []));
      },
    );
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
      {actionNotice && (
        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-md border p-3 text-xs",
            actionNotice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          )}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>{actionNotice.message}</span>
          </div>
          {actionNotice.action === "accounts" && (
            <button
              type="button"
              className="shrink-0 rounded-md border border-amber-200 bg-white px-2 py-1 text-amber-700 transition hover:border-amber-300"
              onClick={() => router.push("/distribution/accounts")}
            >
              去账号管理
            </button>
          )}
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
      <ConfirmHost />
    </section>
  );
}

function buildRetryNotice(batch: PublishBatchSummary, jobs: PublishJob[]): ActionNotice {
  const requested = batch.statusCounts.failed ?? 0;
  if (jobs.length === 0) {
    return {
      tone: "warning",
      message: requested > 0
        ? `已请求重试 ${requested} 个失败任务，但后端没有返回可更新任务；请刷新后查看详情。`
        : "当前批次没有可重试的失败任务。",
    };
  }
  const accountBlocked = jobs.filter(isAccountStateBlocked);
  const stillFailed = jobs.filter((j) => j.status === "failed");
  if (accountBlocked.length === jobs.length) {
    return {
      tone: "warning",
      message: `已尝试重试 ${jobs.length} 个失败任务，但账号仍不可用或已解绑；请先重新绑定账号后再重试。`,
      action: "accounts",
    };
  }
  if (accountBlocked.length > 0) {
    return {
      tone: "warning",
      message: `已尝试重试 ${jobs.length} 个失败任务，其中 ${accountBlocked.length} 个因账号不可用未发起；其余任务已重新进入分发流程。`,
      action: "accounts",
    };
  }
  if (stillFailed.length === jobs.length) {
    return {
      tone: "warning",
      message: `已尝试重试 ${jobs.length} 个失败任务，但任务仍然失败；请打开详情查看具体错误。`,
    };
  }
  return {
    tone: "success",
    message: `已发起重试 ${jobs.length} 个失败任务，页面会继续同步分发进度。`,
  };
}

function isAccountStateBlocked(job: PublishJob): boolean {
  return (
    job.errorCode === "ACCOUNT_EXPIRED" ||
    job.errorCode === "ACCOUNT_NOT_ACTIVE" ||
    job.errorCode === "SOCIAL_ACCOUNT_NOT_FOUND" ||
    job.errorCode === "ACCOUNT_STATE_DECRYPT_FAILED" ||
    /账号登录已失效|社交账号不可用|社交账号不存在|账号凭据解密失败/.test(job.errorMessage ?? "")
  );
}
