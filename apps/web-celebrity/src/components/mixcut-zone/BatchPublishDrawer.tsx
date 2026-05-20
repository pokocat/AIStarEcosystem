"use client";

// v0.15+: 混剪 → 发布 桥接 UI。
// 弹出抽屉：变体多选 + 社交账号多选 + 文案 + 可选定时发布。
// 调用 MixcutApi.publishBatch 把 outputs × targets 派单成 N×M 条 PublishJob。

import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, X, Clock, AlertCircle } from "lucide-react";
import { MixcutApi } from "@/api";
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

  const [scheduledEnabled, setScheduledEnabled] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalDateTimeInput(d);
  });

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
      const scheduledAt = scheduledEnabled ? new Date(scheduledLocal).toISOString() : undefined;
      const outputs = publishable.filter((p) => selectedOutputs.includes(p.output_id));
      const targets = accounts
        .filter((a) => selectedAccountIds.includes(a.id))
        .map((a) => ({
          platform: a.platform,
          social_account_id: a.id,
          scheduled_at: scheduledAt,
        }));

      const tags = tagsRaw
        .split(/[,，#]/)
        .map((s) => s.trim())
        .filter(Boolean);

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

  const canSubmit =
    !submitting &&
    !result &&
    title.trim().length > 0 &&
    selectedOutputs.length > 0 &&
    selectedAccountIds.length > 0;

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
              {scheduledEnabled && totalJobs > 0 && " · 定时"}
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

              {/* Scheduling */}
              <section className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduledEnabled}
                    onChange={(e) => setScheduledEnabled(e.target.checked)}
                    className="accent-violet-500"
                  />
                  <Clock className="size-3.5" />
                  定时发布
                </label>
                {scheduledEnabled && (
                  <div className="pl-6 space-y-1">
                    <input
                      type="datetime-local"
                      value={scheduledLocal}
                      onChange={(e) => setScheduledLocal(e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      使用本地时区 ({Intl.DateTimeFormat().resolvedOptions().timeZone}
                      )，提交时转 UTC。后台 60s 扫描器到点自动启动。
                    </p>
                  </div>
                )}
              </section>

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
                      <Send className="size-4" /> {scheduledEnabled ? "定时派单" : "立即派单"}
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
