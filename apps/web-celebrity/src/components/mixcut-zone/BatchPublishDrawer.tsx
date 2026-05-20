"use client";

// v0.15+: 混剪 → 发布 桥接 UI。
// 弹出抽屉：变体多选 + 社交账号多选 + 文案 + 可选定时发布。
// 调用 MixcutApi.publishBatch 把 outputs × targets 派单成 N×M 条 PublishJob。

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, X, Clock, AlertCircle, Calendar, Sparkles, Plus } from "lucide-react";
import { MixcutApi } from "@/api";
import type { ScheduleSpec } from "@/api/mixcut";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import { Button } from "@/components/mixcut-zone/ui/button";
import { cn } from "@/components/mixcut-zone/lib/utils";
import { SocialAccountApi } from "@ai-star-eco/api-client";
import type { SocialAccount } from "@ai-star-eco/types/social-account";
import { platformAccountLabel, platformDisplayName } from "@/components/distribution/social-account-labels";

/** 可发布的变体 —— job-detail 与多任务工作台都按此结构传给抽屉。 */
export interface BatchPublishItem {
  output_id: string;
  label: string;             // 用于 UI 显示，如 "job_xxx · v2"
  cdn_url: string;
  thumbnail_url?: string;
}

interface Props {
  /** 可选：单任务上下文（详情页用）。提供时自动推导 items 与 defaultTitle。 */
  job?: RenderJob;
  /** 直接传 items 列表（多任务工作台用）。优先级高于 job。 */
  items?: BatchPublishItem[];
  /** 发布请求中的 source_mixcut_job_id（仅单任务场景有意义）。 */
  sourceJobId?: string;
  /** 默认标题（缺省时空）。 */
  defaultTitle?: string;
  /** 跳过的（无 cdn_url）变体数量，仅作提示展示。 */
  skippedCount?: number;
  open: boolean;
  onClose: () => void;
  onPublished?: (result: MixcutApi.MixcutPublishBatchResult) => void;
}

export function BatchPublishDrawer({
  job,
  items,
  sourceJobId,
  defaultTitle,
  skippedCount: skippedCountProp,
  open,
  onClose,
  onPublished,
}: Props) {
  // 单任务场景：从 job.outputs 派生 items
  const derivedItems: BatchPublishItem[] = useMemo(() => {
    if (items) return items;
    if (!job) return [];
    return (job.outputs ?? [])
      .filter((o: RenderOutput & { cdn_url?: string; cdn_thumbnail_url?: string }) => Boolean(o.cdn_url))
      .map((o: RenderOutput & { cdn_url?: string; cdn_thumbnail_url?: string }) => ({
        output_id: o.id,
        label: `v${o.variant_index + 1}`,
        cdn_url: o.cdn_url!,
        thumbnail_url: o.cdn_thumbnail_url || o.thumbnail_url || undefined,
      }));
  }, [items, job]);

  const publishable = derivedItems;
  const totalOutputs = items
    ? items.length
    : (job?.outputs?.length ?? 0);
  const skippedCount = skippedCountProp ?? (totalOutputs - publishable.length);

  const effectiveSourceJobId = sourceJobId ?? job?.id;
  const effectiveDefaultTitle =
    defaultTitle ?? (job?.template_name ? `${job.template_name} 混剪` : "混剪发布");

  const [selectedOutputs, setSelectedOutputs] = useState<string[]>(publishable.map((p) => p.output_id));
  const [allAccounts, setAllAccounts] = useState<SocialAccount[]>([]);
  // 仅 active 的能选；其他状态（expired / banned / pending）在 UI 上隐藏，
  // 通过下方提示让用户去账号管理处理 —— 派单时选错了状态没意义，反而干扰。
  const accounts = useMemo(
    () => allAccounts.filter((a) => a.status === "active"),
    [allAccounts]
  );
  const unavailableCount = allAccounts.length - accounts.length;
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [title, setTitle] = useState(effectiveDefaultTitle);
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");

  // v0.20: 调度策略 ——「立即 / 单次定时 / 每日定时铺开」三选一。
  // 旧 scheduledEnabled + scheduledLocal 退役；single 分支保留 datetime-local 体验。
  const [strategy, setStrategy] = useState<StrategyKind>("immediate");
  const [singleAt, setSingleAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalDateTimeInput(d);
  });
  const [startDate, setStartDate] = useState<string>(() => toLocalDateInput(new Date()));
  const [timeSlots, setTimeSlots] = useState<string[]>(["09:00", "12:00", "18:00"]);
  const [capMode, setCapMode] = useState<"exhaust" | "days">("exhaust");
  const [maxDays, setMaxDays] = useState<number>(7);
  // 用户主动改过 maxDays 后就停止 auto-suggest，避免覆盖用户选择
  const maxDaysDirtyRef = useRef(false);
  const [jitterEnabled, setJitterEnabled] = useState(false);
  const [jitterMinutes, setJitterMinutes] = useState(15);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<MixcutApi.MixcutPublishBatchResult | null>(null);

  // 只在 drawer 打开瞬间初始化一次。
  // 故意不依赖 publishable —— 否则父组件在 onPublished 回调里清空上游 selection 会导致
  // items → publishable 变 []，再触发本 effect 把刚 setResult 的成功结果擦掉，
  // ResultSummary 闪过后立刻退回到 "publishable.length===0 → 视频还在合成中" 空态分支。
  useEffect(() => {
    if (!open) return;
    setSelectedOutputs(publishable.map((p) => p.output_id));
    setResult(null);
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoadingAccounts(true);
    setAccountsError(null);
    SocialAccountApi.listSocialAccounts()
      .then((list) => {
        setAllAccounts(list ?? []);
      })
      .catch((e: unknown) => {
        setAccountsError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => setLoadingAccounts(false));
  }, [open]);

  if (!open) return null;

  const toggleOutput = (id: string) => {
    setSelectedOutputs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  const toggleAccount = (id: string) => {
    setSelectedAccountIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const totalJobs = selectedOutputs.length * selectedAccountIds.length;

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const outputs = publishable.filter((p) => selectedOutputs.includes(p.output_id));
      const targets = accounts
        .filter((a) => selectedAccountIds.includes(a.id))
        .map((a) => ({
          platform: a.platform,
          social_account_id: a.id,
        }));

      const tags = tagsRaw
        .split(/[,，#]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const schedule = buildScheduleSpec();

      const res = await MixcutApi.publishBatch({
        source_mixcut_job_id: effectiveSourceJobId,
        outputs: outputs.map((p) => ({
          output_id: p.output_id,
          cdn_url: p.cdn_url,
          thumbnail_url: p.thumbnail_url,
        })),
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.length ? tags : undefined,
        targets,
        schedule,
        project_id: undefined,
      });
      setResult(res);
      onPublished?.(res);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "发布失败");
    } finally {
      setSubmitting(false);
    }
  };

  /** 把当前 UI 状态打包成 ScheduleSpec（与后端 MixcutPublishService.expandSchedule 1:1 对齐）。 */
  const buildScheduleSpec = (): ScheduleSpec => {
    if (strategy === "immediate") return { strategy: "immediate" };
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

  // ─── v0.20: 每日定时铺开 - 自动建议天数 + 预览 + 容量校验 ──────────────
  const slotCount = sortDedupSlots(timeSlots).length;

  // 若用户没手改过 maxDays，根据选中数量自动建议
  useEffect(() => {
    if (strategy !== "daily_recurring" || capMode !== "days") return;
    if (maxDaysDirtyRef.current) return;
    if (slotCount === 0 || selectedOutputs.length === 0) return;
    const suggested = Math.min(30, Math.max(1, Math.ceil(selectedOutputs.length / slotCount)));
    setMaxDays((cur) => (cur === suggested ? cur : suggested));
  }, [strategy, capMode, slotCount, selectedOutputs.length]);

  const dailyPreview = useMemo(() => {
    if (strategy !== "daily_recurring") return null;
    return expandDailyRecurringPreview(
      selectedOutputs.length,
      timeSlots,
      startDate,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  }, [strategy, selectedOutputs.length, timeSlots, startDate]);

  // 容量超限：仅在「持续 N 天」模式生效
  const capacityShortfall = (() => {
    if (strategy !== "daily_recurring" || capMode !== "days") return null;
    if (slotCount === 0) return null;
    const cap = maxDays * slotCount;
    if (selectedOutputs.length <= cap) return null;
    return { selected: selectedOutputs.length, cap, maxDays, slotCount };
  })();

  const canSubmit =
    !submitting &&
    !result &&
    title.trim().length > 0 &&
    selectedOutputs.length > 0 &&
    selectedAccountIds.length > 0 &&
    !capacityShortfall &&
    (strategy !== "daily_recurring" || slotCount > 0);

  // 顶部副标题描述当前策略
  const strategyChip =
    strategy === "immediate"
      ? null
      : strategy === "single"
        ? "单次定时"
        : `每日铺开 · 每天 ${slotCount} 次`;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      {/* panel */}
      <div className="relative ml-auto h-full w-[560px] max-w-[95vw] bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">批量发布</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              选择变体 × 账号 = {totalJobs} 条发布任务
              {strategyChip && totalJobs > 0 && ` · ${strategyChip}`}
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {result ? (
            <ResultSummary result={result} />
          ) : (
            <>
              {/* Variants */}
              <section>
                <header className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">变体 ({publishable.length} 可发)</h3>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedOutputs(publishable.map((p) => p.output_id))}
                    >
                      全选
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedOutputs([])}
                    >
                      清空
                    </button>
                  </div>
                </header>
                {publishable.length === 0 ? (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      视频还在合成中，请稍候再试。可以回到任务详情页看看渲染进度。
                    </div>
                  </div>
                ) : (
                  // 紧凑列表：左侧已经能看到缩略图，这里专注于「核对要发哪些 + 一键开关」
                  <ul className="rounded-md border border-border divide-y divide-border max-h-[200px] overflow-y-auto">
                    {publishable.map((p) => {
                      const sel = selectedOutputs.includes(p.output_id);
                      return (
                        <li key={p.output_id}>
                          <button
                            type="button"
                            onClick={() => toggleOutput(p.output_id)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                              sel ? "bg-violet-500/5" : "hover:bg-secondary/50"
                            )}
                          >
                            <span
                              className={cn(
                                "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                sel
                                  ? "bg-violet-500 border-violet-500 text-white"
                                  : "border-zinc-300 bg-white"
                              )}
                            >
                              {sel && <span className="text-[10px] font-bold">✓</span>}
                            </span>
                            <span className="font-mono text-[12px] text-foreground truncate">
                              {p.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {skippedCount > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    另有 {skippedCount} 条还没合成完成，已跳过
                  </p>
                )}
              </section>

              {/* Accounts */}
              <section>
                <header className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">账号 ({accounts.length} 可用)</h3>
                  {accounts.length > 0 && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedAccountIds(accounts.map((a) => a.id))}
                      >
                        全选
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedAccountIds([])}
                      >
                        清空
                      </button>
                    </div>
                  )}
                </header>
                {loadingAccounts ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    <Loader2 className="size-3 inline animate-spin mr-1" />
                    加载账号中…
                  </div>
                ) : accountsError ? (
                  <div className="text-xs text-rose-500">加载失败：{accountsError}</div>
                ) : accounts.length === 0 ? (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
                    {allAccounts.length === 0 ? (
                      <>
                        还没有绑定任何账号。先到{" "}
                        <a href="/distribution/accounts" className="underline">
                          账号管理
                        </a>{" "}
                        绑定一个。
                      </>
                    ) : (
                      <>
                        当前 {allAccounts.length} 个账号都不可用（已失效 / 绑定中 / 被封禁）。请到{" "}
                        <a href="/distribution/accounts" className="underline">
                          账号管理
                        </a>{" "}
                        重新验证。
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <ul className="rounded-md border border-border divide-y divide-border max-h-[220px] overflow-y-auto">
                      {accounts.map((a) => {
                        const sel = selectedAccountIds.includes(a.id);
                        const subtitle = [
                          platformDisplayName(a.platform),
                          a.displayName,
                          a.platformAccountId
                            ? `${platformAccountLabel(a.platform)} ${a.platformAccountId}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => toggleAccount(a.id)}
                              className={cn(
                                "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                                sel ? "bg-violet-500/5" : "hover:bg-secondary/50"
                              )}
                            >
                              <span
                                className={cn(
                                  "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                  sel
                                    ? "bg-violet-500 border-violet-500 text-white"
                                    : "border-zinc-300 bg-white"
                                )}
                              >
                                {sel && <span className="text-[10px] font-bold">✓</span>}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{a.accountName}</div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {subtitle}
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {unavailableCount > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        另有 {unavailableCount} 个账号当前不可用（已失效 / 绑定中），可到{" "}
                        <a href="/distribution/accounts" className="underline">
                          账号管理
                        </a>{" "}
                        重新验证
                      </p>
                    )}
                  </>
                )}
              </section>

              {/* Metadata */}
              <section className="space-y-3">
                <h3 className="text-sm font-medium">文案</h3>
                <div>
                  <label className="text-xs text-muted-foreground">标题</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例：5 折回归限时三天"
                    className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">描述（可选）</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="详细描述…"
                    rows={3}
                    className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">标签（可选，逗号或 # 分隔）</label>
                  <input
                    type="text"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="例：美妆,限时,5折"
                    className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
                  />
                </div>
              </section>

              {/* v0.20: 调度策略 */}
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
                preview={dailyPreview}
                capacityShortfall={capacityShortfall}
                selectedOutputCount={selectedOutputs.length}
              />

              {submitError && (
                <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-md p-3">
                  {submitError}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3 bg-secondary/30">
          {result ? (
            <Button variant="default" className="ml-auto" onClick={onClose}>
              完成
            </Button>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                共 <span className="font-mono font-semibold text-foreground">{totalJobs}</span> 条发布任务
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={submitting}>
                  取消
                </Button>
                <Button variant="gradient" disabled={!canSubmit} onClick={handleSubmit}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> 提交中
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />{" "}
                      {strategy === "immediate" ? "立即派单" : strategy === "single" ? "定时派单" : "铺开派单"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultSummary({ result }: { result: MixcutApi.MixcutPublishBatchResult }) {
  const successCount = result.success_jobs?.length ?? 0;
  const failedCount = result.failed_items?.length ?? 0;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          已成功派单 {successCount} 条
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          可到 <a href="/distribution/jobs" className="underline">任务追踪</a> 查看进度。
        </p>
      </div>
      {failedCount > 0 && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
          <div className="text-sm font-medium text-rose-600 dark:text-rose-400">
            {failedCount} 条失败
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {result.failed_items.map((f, i) => (
              <li key={i}>
                <span className="font-mono">{f.output_id ?? "?"}</span>: {f.reason}
                {f.detail ? ` — ${f.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">
        共请求 {result.total_requested} 条；成功率 {successCount}/{result.total_requested}。
      </div>
    </div>
  );
}

// ─── v0.20: 调度策略编辑器 ───────────────────────────────────────────────

interface ScheduleEditorProps {
  strategy: StrategyKind;
  onStrategyChange: (s: StrategyKind) => void;
  singleAt: string;
  onSingleAtChange: (s: string) => void;
  startDate: string;
  onStartDateChange: (s: string) => void;
  timeSlots: string[];
  onTimeSlotsChange: (slots: string[]) => void;
  capMode: "exhaust" | "days";
  onCapModeChange: (m: "exhaust" | "days") => void;
  maxDays: number;
  onMaxDaysChange: (n: number) => void;
  jitterEnabled: boolean;
  onJitterEnabledChange: (b: boolean) => void;
  jitterMinutes: number;
  onJitterMinutesChange: (n: number) => void;
  preview: DailyRecurringPreview | null;
  capacityShortfall: { selected: number; cap: number; maxDays: number; slotCount: number } | null;
  selectedOutputCount: number;
}

function ScheduleEditor(props: ScheduleEditorProps) {
  const {
    strategy, onStrategyChange,
    singleAt, onSingleAtChange,
    startDate, onStartDateChange,
    timeSlots, onTimeSlotsChange,
    capMode, onCapModeChange,
    maxDays, onMaxDaysChange,
    jitterEnabled, onJitterEnabledChange,
    jitterMinutes, onJitterMinutesChange,
    preview, capacityShortfall,
    selectedOutputCount,
  } = props;

  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState("09:00");

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const slotCount = sortDedupSlots(timeSlots).length;

  const applyPreset = (slots: string[]) => onTimeSlotsChange(slots);
  const removeSlot = (s: string) => onTimeSlotsChange(timeSlots.filter((x) => x !== s));
  const addSlot = () => {
    onTimeSlotsChange(sortDedupSlots([...timeSlots, newSlot]));
    setShowAddSlot(false);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock className="size-3.5" />
        发布时机
      </div>

      {/* 三选一 radio pill */}
      <div className="grid grid-cols-3 gap-1.5">
        <StrategyPill
          active={strategy === "immediate"}
          label="立即发布"
          desc="马上派单起飞"
          onClick={() => onStrategyChange("immediate")}
        />
        <StrategyPill
          active={strategy === "single"}
          label="单次定时"
          desc="所有任务同一时刻"
          onClick={() => onStrategyChange("single")}
        />
        <StrategyPill
          active={strategy === "daily_recurring"}
          label="每日铺开"
          desc="按节奏跨天派单"
          onClick={() => onStrategyChange("daily_recurring")}
        />
      </div>

      {/* 单次定时分支 */}
      {strategy === "single" && (
        <div className="space-y-1 pl-1">
          <input
            type="datetime-local"
            value={singleAt}
            onChange={(e) => onSingleAtChange(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
          />
          <p className="text-[11px] text-muted-foreground">
            使用本地时区（{tz}），提交时转 UTC；后台扫描器到点自动起飞。
          </p>
        </div>
      )}

      {/* 每日铺开分支 */}
      {strategy === "daily_recurring" && (
        <div className="space-y-3 pl-1">
          {/* 起始日期 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="size-3.5 text-muted-foreground" />
            <label className="text-xs text-muted-foreground">起始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="px-2 py-1 text-sm rounded-md border border-border bg-background"
            />
            <span className="text-[10px] text-muted-foreground">
              过去日期会立即起飞
            </span>
          </div>

          {/* 预设 chip 行 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">一键预设</label>
            <div className="flex flex-wrap gap-1.5">
              {SLOT_PRESETS.map((p) => {
                const active = arraysEqual(sortDedupSlots(p.slots), sortDedupSlots(timeSlots));
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.slots)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] rounded-full border transition-colors",
                      active
                        ? "bg-violet-500 border-violet-500 text-white"
                        : "bg-background border-border text-foreground hover:border-violet-300",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 自定义时段编辑 */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              时段（{slotCount} 个）
            </label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {sortDedupSlots(timeSlots).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded-md bg-violet-50 border border-violet-200 text-violet-700"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSlot(s)}
                    aria-label={`移除 ${s}`}
                    className="text-violet-400 hover:text-rose-500"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {showAddSlot ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="time"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    className="px-2 py-0.5 text-[11px] rounded border border-border bg-background"
                  />
                  <button
                    type="button"
                    onClick={addSlot}
                    className="text-[11px] text-violet-600 hover:underline"
                  >
                    添加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSlot(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddSlot(true)}
                  className="inline-flex items-center gap-0.5 px-2 py-1 text-[11px] rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-violet-300"
                >
                  <Plus className="size-3" />
                  自定义
                </button>
              )}
            </div>
          </div>

          {/* 容量 radio */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">持续</label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={capMode === "exhaust"}
                  onChange={() => onCapModeChange("exhaust")}
                  className="accent-violet-500"
                />
                直到视频用完
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={capMode === "days"}
                  onChange={() => onCapModeChange("days")}
                  className="accent-violet-500"
                />
                持续
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={maxDays}
                  onChange={(e) => onMaxDaysChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  onFocus={() => onCapModeChange("days")}
                  className="w-14 px-1.5 py-0.5 text-sm rounded border border-border bg-background"
                />
                天
              </label>
            </div>
          </div>

          {/* 随机抖动 */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={jitterEnabled}
                onChange={(e) => onJitterEnabledChange(e.target.checked)}
                className="accent-violet-500"
              />
              <Sparkles className="size-3.5" />
              让发帖时间更像人工
            </label>
            {jitterEnabled && (
              <div className="pl-6 flex items-center gap-2 text-xs text-muted-foreground">
                <span>±</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={jitterMinutes}
                  onChange={(e) => onJitterMinutesChange(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className="w-14 px-1.5 py-0.5 text-sm rounded border border-border bg-background"
                />
                <span>分钟随机偏移（最大 30 分钟）</span>
              </div>
            )}
          </div>

          {/* 预览 / 容量超限警告 */}
          {capacityShortfall ? (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-2.5 flex items-start gap-2">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <div>
                视频超过容量：{capacityShortfall.selected} 条 &gt;{" "}
                {capacityShortfall.maxDays} 天 × {capacityShortfall.slotCount} 槽 ={" "}
                {capacityShortfall.cap} 容量。
                <br />
                请增加天数 / 时段，或减少选中变体。
              </div>
            </div>
          ) : preview && selectedOutputCount > 0 ? (
            <div className="text-[11px] text-violet-700 bg-violet-50 border border-violet-200 rounded-md p-2.5 space-y-0.5">
              <div>
                共 <b>{preview.totalJobs}</b> 条变体 · 跨{" "}
                <b>{preview.totalDays}</b> 天
              </div>
              <div>
                首条 {formatPreviewSlot(preview.firstSlotAt, preview.firstSlotInPast)} · 末条{" "}
                {formatPreviewSlot(preview.lastSlotAt, false)}
                {jitterEnabled && jitterMinutes > 0 && (
                  <span className="text-violet-500"> · ±{jitterMinutes} 分钟抖动</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                按勾选顺序铺开 · 时区 {tz}
              </div>
            </div>
          ) : slotCount === 0 ? (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2.5">
              至少留 1 个时段；点上面预设或「+ 自定义」补一条。
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StrategyPill({
  active, label, desc, onClick,
}: { active: boolean; label: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-md border text-left transition-colors",
        active
          ? "bg-violet-500/10 border-violet-500 text-violet-700"
          : "bg-background border-border text-foreground hover:border-violet-300",
      )}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[10px] text-muted-foreground">{desc}</div>
    </button>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Date → "YYYY-MM-DDTHH:mm" 本地时区字符串（datetime-local 用）。 */
function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

/** Date → "YYYY-MM-DD"（date input 用）。 */
function toLocalDateInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

// ─── v0.20: 调度策略类型与工具 ───────────────────────────────────────────
type StrategyKind = "immediate" | "single" | "daily_recurring";

/** 时段排序去重，丢弃格式不合法的。后端 MixcutPublishService 会做同样的 normalize。 */
function sortDedupSlots(slots: string[]): string[] {
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  const set = new Set<string>();
  for (const s of slots) if (re.test(s)) set.add(s);
  return Array.from(set).sort();
}

/** 一键预设：「每天 N 次」chip。点击直接覆盖 timeSlots。 */
const SLOT_PRESETS: { label: string; slots: string[] }[] = [
  { label: "每天 3 次 · 09/12/18", slots: ["09:00", "12:00", "18:00"] },
  { label: "每天 2 次 · 12/19", slots: ["12:00", "19:00"] },
  { label: "每天 1 次 · 19:00", slots: ["19:00"] },
  { label: "晚间高峰 · 19/21/22:30", slots: ["19:00", "21:00", "22:30"] },
];

interface DailyRecurringPreview {
  totalJobs: number;
  totalDays: number;
  firstSlotAt: Date;
  lastSlotAt: Date;
  /** 若起始日期 + 前几个 slot 已过去，标 true —— 这些会 clamp 到 now。 */
  firstSlotInPast: boolean;
}

/**
 * 计算 daily_recurring 的预览信息。前后端算法必须 1:1 对齐：
 *   apps/server/.../mixcut/MixcutPublishService.java#expandDailyRecurring
 * 这里只算 first/last 的「理论 slot」（不应用抖动；抖动只是 ±N 分钟显示提示）。
 */
function expandDailyRecurringPreview(
  outputs: number,
  slots: string[],
  startDate: string,
  tz: string,
): DailyRecurringPreview | null {
  if (outputs <= 0 || slots.length === 0 || !startDate) return null;
  const sortedSlots = sortDedupSlots(slots);
  if (sortedSlots.length === 0) return null;
  const k = sortedSlots.length;
  const totalDays = Math.ceil(outputs / k);
  const firstSlotAt = slotToDate(startDate, sortedSlots[0], tz);
  const lastIdx = outputs - 1;
  const lastDayOffset = Math.floor(lastIdx / k);
  const lastSlot = sortedSlots[lastIdx % k];
  const lastDate = addDays(startDate, lastDayOffset);
  const lastSlotAt = slotToDate(lastDate, lastSlot, tz);
  return {
    totalJobs: outputs,
    totalDays,
    firstSlotAt,
    lastSlotAt,
    firstSlotInPast: firstSlotAt.getTime() < Date.now(),
  };
}

/** "YYYY-MM-DD" + "HH:MM" 在指定 IANA 时区下解释为绝对时间 Date。 */
function slotToDate(date: string, slot: string, tz: string): Date {
  // 浏览器没法直接「在某 IANA 时区下解释 wall-clock」。tricks：构造 UTC Date 然后用
  // Intl 的反向偏移修正。对本仓库主要场景 Asia/Shanghai 无 DST，结果稳定；
  // 跨 DST 边界时差 1 小时，前端预览可以接受 —— 服务端是真值源。
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = slot.split(":").map(Number);
  // 用本机 tz 构造一个候选；如果用户的本机 tz 与 schedule 的 tz 一致（最常见情况），
  // 这就是正确答案。否则做一次偏移补偿。
  const candidate = new Date(y, m - 1, d, hh, mm, 0, 0);
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz === localTz) return candidate;
  // 用 toLocaleString 计算 tz 下的「真实 wall clock」与候选的偏差，反向修正。
  const asString = candidate.toLocaleString("en-US", { timeZone: tz });
  const reinterpreted = new Date(asString);
  const diffMs = candidate.getTime() - reinterpreted.getTime();
  return new Date(candidate.getTime() + diffMs);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return toLocalDateInput(next);
}

/** 用户友好的预览时间文本：「今 09:00」「明 12:00」「5月23日 18:00」「立即」。 */
function formatPreviewSlot(at: Date, isPast: boolean): string {
  if (isPast) return "立即";
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const today = now;
  const tomorrow = new Date(now.getTime() + 86400000);
  if (sameDay(at, today)) return `今 ${hm}`;
  if (sameDay(at, tomorrow)) return `明 ${hm}`;
  return `${at.getMonth() + 1}月${at.getDate()}日 ${hm}`;
}
