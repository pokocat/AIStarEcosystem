"use client";

// v0.22: 任务追踪「重新调度未开始」对话框。
//
// 仅对 status=queued 的子集生效。已开始 / 终态行原样保留 ——
// 不重设 scheduledAt、不重置 progress。
//
// 复用 ScheduleEditor；隐掉「立即分发」选项（重新调度场景里"立即"等价于让调度器
// 下个 tick 起飞，没有意义；要立即起飞应该走单条「开始」按钮）。

import * as React from "react";
import { Loader2, X, AlertCircle } from "lucide-react";
import { ApiError, PublishJobApi } from "@ai-star-eco/api-client";
import type { ScheduleSpec } from "@ai-star-eco/types/publish-job";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  ScheduleEditor,
  type StrategyKind,
  sortDedupSlots,
  expandDailyRecurringPreview,
  toLocalDateInput,
  toLocalDateTimeInput,
} from "./ScheduleEditor";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** 该批次当前 queued 计数；驱动 ScheduleEditor 预览 + 容量校验 */
  queuedCount: number;
  onRescheduled?: () => void;
}

export function RescheduleBatchDialog({
  open,
  onClose,
  projectId,
  queuedCount,
  onRescheduled,
}: Props) {
  // 不展示 immediate —— 重新调度的语义是「换一个具体的时间」
  const [strategy, setStrategy] = React.useState<StrategyKind>("single");
  const [singleAt, setSingleAt] = React.useState<string>(() =>
    toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [startDate, setStartDate] = React.useState<string>(() => toLocalDateInput(new Date()));
  const [timeSlots, setTimeSlots] = React.useState<string[]>(["09:00", "12:00", "18:00"]);
  const [capMode, setCapMode] = React.useState<"exhaust" | "days">("exhaust");
  const [maxDays, setMaxDays] = React.useState<number>(7);
  const [jitterEnabled, setJitterEnabled] = React.useState(false);
  const [jitterMinutes, setJitterMinutes] = React.useState(15);

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // open 切换重置 state（除策略 + slots 偏好之外都重置）
  React.useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [open]);

  // 容量自动建议（同 BatchPublishDrawer）：未手改 maxDays 时按 queuedCount/slotCount 推一个值
  const maxDaysDirtyRef = React.useRef(false);
  const slotCount = sortDedupSlots(timeSlots).length;
  React.useEffect(() => {
    if (strategy !== "daily_recurring" || capMode !== "days") return;
    if (maxDaysDirtyRef.current) return;
    if (slotCount === 0 || queuedCount === 0) return;
    const suggested = Math.min(30, Math.max(1, Math.ceil(queuedCount / slotCount)));
    setMaxDays((cur) => (cur === suggested ? cur : suggested));
  }, [strategy, capMode, slotCount, queuedCount]);

  const preview = React.useMemo(() => {
    if (strategy !== "daily_recurring") return null;
    return expandDailyRecurringPreview(
      queuedCount,
      timeSlots,
      startDate,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  }, [strategy, queuedCount, timeSlots, startDate]);

  const capacityShortfall = React.useMemo(() => {
    if (strategy !== "daily_recurring" || capMode !== "days") return null;
    if (slotCount === 0) return null;
    const cap = maxDays * slotCount;
    if (queuedCount <= cap) return null;
    return { selected: queuedCount, cap, maxDays, slotCount };
  }, [strategy, capMode, slotCount, maxDays, queuedCount]);

  const canSubmit =
    !submitting &&
    queuedCount > 0 &&
    !capacityShortfall &&
    (strategy === "single" || (strategy === "daily_recurring" && slotCount > 0));

  const buildSpec = (): ScheduleSpec => {
    if (strategy === "single") return { strategy: "single", at: new Date(singleAt).toISOString() };
    const slots = sortDedupSlots(timeSlots);
    const spec: ScheduleSpec = {
      strategy: "daily_recurring",
      start_date: startDate,
      time_slots: slots,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (capMode === "days") spec.max_days = maxDays;
    if (jitterEnabled && jitterMinutes > 0) spec.jitter_minutes = jitterMinutes;
    return spec;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await PublishJobApi.rescheduleBatch(projectId, buildSpec());
      onRescheduled?.();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setErrorMsg(e.message);
      else setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)]">
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-base font-semibold text-zinc-800">重新调度未开始的任务</h2>
        <p className="mt-1 text-xs text-zinc-500">
          仅对 <b className="text-zinc-700">{queuedCount}</b> 条尚未开始（排队中）的任务生效；
          已开始 / 已完成 / 已取消的任务不变。
        </p>

        <div className="mt-4">
          <ScheduleEditor
            strategy={strategy}
            onStrategyChange={setStrategy}
            singleAt={singleAt}
            onSingleAtChange={setSingleAt}
            startDate={startDate}
            onStartDateChange={setStartDate}
            timeSlots={timeSlots}
            onTimeSlotsChange={setTimeSlots}
            capMode={capMode}
            onCapModeChange={setCapMode}
            maxDays={maxDays}
            onMaxDaysChange={(n) => {
              maxDaysDirtyRef.current = true;
              setMaxDays(n);
            }}
            jitterEnabled={jitterEnabled}
            onJitterEnabledChange={setJitterEnabled}
            jitterMinutes={jitterMinutes}
            onJitterMinutesChange={setJitterMinutes}
            preview={preview}
            capacityShortfall={capacityShortfall}
            selectedOutputCount={queuedCount}
            allowedStrategies={["single", "daily_recurring"]}
          />
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={cn(CTA_SECONDARY)}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(CTA_PRIMARY, submitting && "cursor-wait")}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "提交中…" : "应用新调度"}
          </button>
        </div>
      </div>
    </div>
  );
}
