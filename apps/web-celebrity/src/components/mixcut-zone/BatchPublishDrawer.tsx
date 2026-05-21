"use client";

// v0.15+: 混剪 → 发布 桥接 UI。
// 弹出抽屉：变体多选 + 社交账号多选 + 文案 + 可选定时发布。
// 调用 MixcutApi.publishBatch 把 outputs × targets 派单成 N×M 条 PublishJob。

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, X, AlertCircle, ShoppingBag, Package } from "lucide-react";
import { MixcutApi } from "@/api";
import type { ScheduleSpec } from "@/api/mixcut";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import { Button } from "@/components/mixcut-zone/ui/button";
import { cn } from "@/components/mixcut-zone/lib/utils";
import { SocialAccountApi } from "@ai-star-eco/api-client";
import type { SocialAccount } from "@ai-star-eco/types/social-account";
import { SocialAccountIdentity } from "@/components/distribution/SocialAccountIdentity";
import { ProductPickerDialog } from "@/components/celebrity-zone/ProductPickerDialog";
import {
  ScheduleEditor,
  type StrategyKind,
  sortDedupSlots,
  expandDailyRecurringPreview,
  toLocalDateInput,
  toLocalDateTimeInput,
} from "@/components/distribution/ScheduleEditor";

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
  // v0.22: 抖音商品挂载（蓝V/橱窗带货）。仅当 selectedAccountIds 含至少一个 douyin
  // 账号时显示；非带货视频留空即可。批量场景 = 同一商品挂到 N 条变体，所以这俩
  // 字段是顶层 string 而非 per-output。
  const [productLink, setProductLink] = useState("");
  const [productTitle, setProductTitle] = useState("");

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
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  // 只在 drawer 打开瞬间初始化一次。
  // 故意不依赖 publishable —— 否则父组件在 onPublished 回调里清空上游 selection 会导致
  // items → publishable 变 []，再触发本 effect 把刚 setResult 的成功结果擦掉，
  // ResultSummary 闪过后立刻退回到 "publishable.length===0 → 视频还在合成中" 空态分支。
  useEffect(() => {
    if (!open) return;
    setSelectedOutputs(publishable.map((p) => p.output_id));
    setResult(null);
    setSubmitError(null);
    setProductLink("");
    setProductTitle("");
    setProductPickerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** v0.22: 选中账号里是否至少一个抖音 —— 决定是否显示「抖音商品挂载」section。 */
  const douyinSelected = useMemo(
    () =>
      accounts.some(
        (a) => a.platform === "douyin" && selectedAccountIds.includes(a.id),
      ),
    [accounts, selectedAccountIds],
  );

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

  // ─── v0.20: 每日定时铺开 - 自动建议天数 + 预览 ──────────────
  // 注意：这两个 hook（useEffect + useMemo）必须留在 `if (!open) return null` 之前，
  // 否则 drawer 关闭/打开切换时 hook 数量变化 → React 报 "change in the order of Hooks"。
  // 历史 bug：v0.20 把它们放在了 early-return 之后（紧贴使用点），打开抽屉就崩。
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

      // v0.22: 抖音商品挂载顶层透传。非 douyin 平台 sau-service 会忽略，安全。
      // 只在两项都非空时携带（半残挂件没有意义；上游单条 path 同样按 AND 触发）。
      const productLinkTrimmed = productLink.trim();
      const productTitleTrimmed = productTitle.trim();
      const carryProduct = douyinSelected && productLinkTrimmed && productTitleTrimmed;

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
        product_link: carryProduct ? productLinkTrimmed : undefined,
        product_title: carryProduct ? productTitleTrimmed : undefined,
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

  // ─── v0.20: 每日定时铺开 - 容量校验（slotCount / 自动建议 / 预览 hook 已上移到 early-return 之前） ─
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
        ? "定时分发"
        : `分期分发 · 每天 ${slotCount} 次`;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      {/* panel */}
      <div className="relative ml-auto h-full w-[560px] max-w-[95vw] bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">分发视频</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              视频 × 账号 = {totalJobs} 条分发任务
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
                  <h3 className="text-sm font-medium">视频 ({publishable.length} 条可分发)</h3>
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
                      视频还在生成，请稍后再来。可以回到任务详情看进度。
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
                    另有 {skippedCount} 条还没生成完成，已跳过
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
                              <SocialAccountIdentity account={a} size="sm" className="flex-1" />
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

              {/* v0.22: 抖音商品挂载 —— 仅当选中账号里至少一个 douyin 才出现。
                  批量场景：同一商品挂到 N 条变体上，所以是顶层字段不是 per-output。
                  非带货视频留空即可；任一字段为空时整组忽略，避免半残挂件。 */}
              {douyinSelected ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <ShoppingBag className="size-3.5 text-muted-foreground" />
                      抖音商品挂载
                    </h3>
                    <button
                      type="button"
                      onClick={() => setProductPickerOpen(true)}
                      className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-600 transition hover:border-violet-500/50 hover:bg-violet-500/15"
                    >
                      <Package className="size-3" />
                      从商品库选择
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    蓝V / 橱窗带货；视频画面下方挂「立即购买」卡片。两项都填才会触发挂件；
                    非抖音平台账号 sau-service 会自动忽略。
                  </p>
                  <div>
                    <label className="text-xs text-muted-foreground">商品链接</label>
                    <input
                      type="url"
                      value={productLink}
                      onChange={(e) => setProductLink(e.target.value)}
                      placeholder="抖店商品详情页 URL，例 https://haohuo.jinritemai.com/..."
                      className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">商品名</label>
                    <input
                      type="text"
                      value={productTitle}
                      onChange={(e) => setProductTitle(e.target.value)}
                      placeholder="挂件文案，例：限时 5 折 · 立即抢购"
                      maxLength={50}
                      className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background"
                    />
                    {productTitle && !productLink ? (
                      <p className="mt-1 text-[11px] text-amber-600">
                        该商品未填链接，挂件不会触发；到商品库补一下链接再来。
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        最长 50 字；将作为视频底部「立即购买」按钮上方的商品标题展示。
                      </p>
                    )}
                  </div>
                </section>
              ) : null}

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
                共 <span className="font-mono font-semibold text-foreground">{totalJobs}</span> 条分发任务
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
                      {strategy === "immediate" ? "立即分发" : strategy === "single" ? "定时分发" : "分期分发"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <ProductPickerDialog
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onPick={(p) => {
          setProductLink(p.link ?? "");
          setProductTitle(p.name.slice(0, 50));
        }}
      />
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
          已成功提交 {successCount} 条分发
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          可到 <a href="/distribution/jobs" className="underline">分发进度</a> 查看实时状态。
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

// v0.22: ScheduleEditor + 工具函数已迁到 components/distribution/ScheduleEditor.tsx 共享。
// 本文件只保留 BatchPublishDrawer 自身的渲染 + 提交逻辑。
