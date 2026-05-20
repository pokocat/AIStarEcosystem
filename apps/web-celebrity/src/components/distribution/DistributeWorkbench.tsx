"use client";

// 分发中心 > 分发工作台
//
// 用户行为路径：「批量制作视频 → 绑定账号 → 分发视频」中的最后一步。
// 把跨任务、跨平台的批量派单收口在分发中心，混剪只负责制作。
//
// 双视图：
//  - grid:  所有任务的可发变体平铺成网格，按 created_at 倒序 — 像「选照片」一样勾视频
//  - group: 按任务分组（每个任务一张卡片，可展开变体）— 关心模板和任务上下文时用
//
// 配置 → 派单 复用 BatchPublishDrawer（items[] 模式），不重复造选账号 / 文案 / 定时的 UI。
//
// 深链：?from_job=<jobId> — 进入时自动展开该任务、勾选其全部可发变体并平滑滚动到该任务。
// 由 mixcut/jobs/[id] 的「去分发中心」入口触发。

import * as React from "react";
import Link from "next/link";
import {
  Send,
  RefreshCw,
  Search,
  X,
  Filter,
  LayoutGrid,
  Rows,
  Sparkles,
  CheckCircle2,
  ImageOff,
} from "lucide-react";
import { MixcutApi } from "@/api";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import {
  BatchPublishDrawer,
  type BatchPublishItem,
} from "@/components/mixcut-zone/BatchPublishDrawer";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";

type ViewMode = "grid" | "group";

/** 已发布过的变体：避免用户重复派单。基于本地存储，server 暂未追加该索引。 */
const PUBLISHED_KEY = "aep:distribute:published-output-ids";

interface Props {
  /** 深链预选某任务（来自 /mixcut/jobs/[id] 的「去分发中心」入口） */
  fromJobId?: string;
}

type EligibleOutput = RenderOutput & {
  cdn_url?: string;
  cdn_thumbnail_url?: string;
};

interface FlatItem {
  jobId: string;
  jobTemplateName: string;
  jobCreatedAt: string;
  output: EligibleOutput;
}

export function DistributeWorkbench({ fromJobId }: Props) {
  const [jobs, setJobs] = React.useState<RenderJob[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedOutputIds, setSelectedOutputIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [expandedJobs, setExpandedJobs] = React.useState<Set<string>>(() => new Set());
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [showPublished, setShowPublished] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [publishedIds, setPublishedIds] = React.useState<Set<string>>(() => loadPublished());
  const fromJobAnchorRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async () => {
    try {
      const list = await MixcutApi.listJobs();
      setJobs(list ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // 仅保留 success + 至少一条 cdn_url 的任务
  const eligibleJobs = React.useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((j) => {
      if (j.status !== "success") return false;
      const outs = (j.outputs ?? []) as EligibleOutput[];
      return outs.some((o) => Boolean(o.cdn_url));
    });
  }, [jobs]);

  // 平铺所有可发变体；搜索过滤、已发布过滤都基于这个
  const allFlat: FlatItem[] = React.useMemo(() => {
    const result: FlatItem[] = [];
    for (const j of eligibleJobs) {
      const outs = (j.outputs ?? []) as EligibleOutput[];
      for (const o of outs) {
        if (!o.cdn_url) continue;
        result.push({
          jobId: j.id,
          jobTemplateName: j.template_name ?? j.template_id,
          jobCreatedAt: j.created_at,
          output: o,
        });
      }
    }
    // 按 jobCreatedAt 倒序、同任务内按 variant_index 升序
    result.sort((a, b) => {
      const t = new Date(b.jobCreatedAt).getTime() - new Date(a.jobCreatedAt).getTime();
      if (t !== 0) return t;
      return a.output.variant_index - b.output.variant_index;
    });
    return result;
  }, [eligibleJobs]);

  const filteredFlat = React.useMemo(() => {
    const ql = search.trim().toLowerCase();
    return allFlat.filter((f) => {
      if (!showPublished && publishedIds.has(f.output.id)) return false;
      if (!ql) return true;
      return (
        f.jobTemplateName.toLowerCase().includes(ql) ||
        f.jobId.toLowerCase().includes(ql)
      );
    });
  }, [allFlat, search, showPublished, publishedIds]);

  const filteredJobIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const f of filteredFlat) set.add(f.jobId);
    return set;
  }, [filteredFlat]);

  const filteredJobs = React.useMemo(
    () => eligibleJobs.filter((j) => filteredJobIds.has(j.id)),
    [eligibleJobs, filteredJobIds],
  );

  // 深链：from_job_id 命中后展开 + 全选可发变体 + 滚动定位
  const fromJobAppliedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!fromJobId || !jobs) return;
    if (fromJobAppliedRef.current === fromJobId) return;
    const target = jobs.find((j) => j.id === fromJobId);
    if (!target) return;
    const outs = (target.outputs ?? []) as EligibleOutput[];
    const ids = outs.filter((o) => Boolean(o.cdn_url)).map((o) => o.id);
    if (ids.length === 0) return;
    setSelectedOutputIds((cur) => {
      const next = new Set(cur);
      for (const id of ids) next.add(id);
      return next;
    });
    setExpandedJobs((cur) => {
      const next = new Set(cur);
      next.add(fromJobId);
      return next;
    });
    setViewMode("group");
    fromJobAppliedRef.current = fromJobId;
    // 等下一帧再滚
    requestAnimationFrame(() => {
      fromJobAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [fromJobId, jobs]);

  const toggleOutput = (id: string) => {
    setSelectedOutputIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 智能 toggle：当前过滤范围内全选中 → 反向取消；否则全选。
  // 不影响 filteredFlat 之外的已选（比如用户搜索后再切换搜索词），保留已有选择跨过滤稳定。
  const allVisibleSelected = React.useMemo(
    () =>
      filteredFlat.length > 0 &&
      filteredFlat.every((f) => selectedOutputIds.has(f.output.id)),
    [filteredFlat, selectedOutputIds],
  );

  const toggleSelectAllVisible = () => {
    setSelectedOutputIds((cur) => {
      const next = new Set(cur);
      if (allVisibleSelected) {
        for (const f of filteredFlat) next.delete(f.output.id);
      } else {
        for (const f of filteredFlat) next.add(f.output.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedOutputIds(new Set());

  // 单任务 toggle：本任务过滤后的可发变体全选中 → 取消；否则补齐选中。
  const isJobAllSelected = (jobId: string): boolean => {
    const ids = filteredFlat.filter((f) => f.jobId === jobId).map((f) => f.output.id);
    return ids.length > 0 && ids.every((id) => selectedOutputIds.has(id));
  };

  const toggleSelectAllInJob = (jobId: string) => {
    const ids = filteredFlat.filter((f) => f.jobId === jobId).map((f) => f.output.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedOutputIds.has(id));
    setSelectedOutputIds((cur) => {
      const next = new Set(cur);
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  };

  const toggleExpand = (jobId: string) => {
    setExpandedJobs((cur) => {
      const next = new Set(cur);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const selectedItems: BatchPublishItem[] = React.useMemo(() => {
    return allFlat
      .filter((f) => selectedOutputIds.has(f.output.id))
      .map((f) => ({
        output_id: f.output.id,
        label: `${shortJobId(f.jobId)} · v${f.output.variant_index + 1}`,
        cdn_url: f.output.cdn_url!,
        thumbnail_url:
          f.output.cdn_thumbnail_url || f.output.thumbnail_url || undefined,
      }));
  }, [allFlat, selectedOutputIds]);

  const handlePublished = () => {
    // 派单成功：把这批 output_id 标为已发布，UI 默认隐起来
    setPublishedIds((cur) => {
      const next = new Set(cur);
      for (const id of selectedOutputIds) next.add(id);
      persistPublished(next);
      return next;
    });
    setSelectedOutputIds(new Set());
  };

  // ─── 主体 ──────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
      {/* 主区 */}
      <div className="space-y-4 min-w-0">
        {/* 工具条：搜索 + 视图切换 + 已发布过滤 + 刷新 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模板名或任务 ID…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-full border border-zinc-200 bg-white outline-none focus:border-violet-400"
            />
          </div>
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={() => setShowPublished((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border",
              showPublished
                ? "bg-violet-50 border-violet-300 text-violet-700"
                : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300",
            )}
            title="显示/隐藏已经派过单的变体"
          >
            <Filter className="h-3.5 w-3.5" />
            {showPublished ? "含已发布" : "隐已发布"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            aria-label="刷新"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 统计提示 */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 flex-wrap gap-2">
          <span>
            共 <span className="font-mono text-zinc-700">{filteredFlat.length}</span> 条可发布变体（
            {filteredJobs.length} / {eligibleJobs.length} 个任务）
          </span>
          {filteredFlat.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="text-violet-600 hover:underline"
              aria-pressed={allVisibleSelected}
            >
              {allVisibleSelected
                ? `取消全选（已选 ${filteredFlat.length} 条）`
                : `全选当前 ${filteredFlat.length} 条`}
            </button>
          )}
        </div>

        {/* 视频源列表 */}
        {jobs === null && !error && (
          <div className="rounded-2xl border border-zinc-200 bg-white py-12 text-center text-sm text-zinc-400">
            加载混剪任务中…
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}
        {jobs !== null && filteredFlat.length === 0 && !error && (
          <EmptyState
            hasAnyJobs={eligibleJobs.length > 0}
            showingPublished={showPublished}
            hasSearch={search.trim().length > 0}
          />
        )}

        {jobs !== null && filteredFlat.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <GridView
                items={filteredFlat}
                selectedIds={selectedOutputIds}
                publishedIds={publishedIds}
                onToggle={toggleOutput}
              />
            ) : (
              <GroupView
                jobs={filteredJobs}
                flatByJob={groupFlatByJob(filteredFlat)}
                selectedIds={selectedOutputIds}
                publishedIds={publishedIds}
                expanded={expandedJobs}
                onToggleExpand={toggleExpand}
                onToggleOutput={toggleOutput}
                onSelectAllInJob={toggleSelectAllInJob}
                isJobAllSelected={isJobAllSelected}
                highlightedJobId={fromJobId}
                highlightRef={fromJobAnchorRef}
              />
            )}
          </>
        )}
      </div>

      {/* Sticky right rail：已选清单 + 继续发布 */}
      <aside className="lg:sticky lg:top-4 self-start space-y-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-800">已选视频</h3>
            <span className="font-mono text-xs text-zinc-500">{selectedOutputIds.size} 条</span>
          </div>

          {selectedOutputIds.size === 0 ? (
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              从左侧勾选要分发的混剪变体。建议同一批选择「同一明星 / 同一商品」相关变体，便于配统一文案。
            </p>
          ) : (
            <div className="space-y-2">
              <ul className="max-h-[260px] overflow-y-auto pr-1 -mr-1 divide-y divide-zinc-100 rounded-md border border-zinc-100">
                {selectedItems.map((it) => (
                  <li
                    key={it.output_id}
                    className="group flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-zinc-50"
                  >
                    <span className="size-1.5 rounded-full bg-violet-500 shrink-0" />
                    <span className="font-mono text-[11px] text-zinc-700 truncate" title={it.label}>
                      {it.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleOutput(it.output_id)}
                      title="从已选移除"
                      className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-500"
              >
                <X className="h-3 w-3" />
                清空选择
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={selectedOutputIds.size === 0}
            onClick={() => setDrawerOpen(true)}
            className={cn(CTA_PRIMARY, "w-full mt-3")}
          >
            <Send className="h-3.5 w-3.5" />
            继续配置发布 ({selectedOutputIds.size})
          </button>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2 text-[11px] text-zinc-500 leading-relaxed">
          <p>
            <Sparkles className="inline h-3 w-3 mr-1 text-violet-500" />
            下一步将选择社交账号、配文案、设定时（可选）。变体 × 账号 = 总派单数。
          </p>
          <p>· 仅显示已上传到 CDN 的变体；未上传需回到任务详情等渲染完毕。</p>
          <p>· 已派过单的变体默认隐藏，可用「含已发布」开关找回。</p>
          <p>
            · 没绑过账号？先到 <Link href="/distribution/accounts" className="text-violet-600 underline">账号管理</Link> 绑定。
          </p>
        </section>
      </aside>

      <BatchPublishDrawer
        items={selectedItems}
        defaultTitle={selectedItems.length > 0 ? deriveDefaultTitle(selectedItems) : "批量分发"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPublished={handlePublished}
      />
    </div>
  );
}

// ─── 子视图：网格（默认） ──────────────────────────────────────────────────
function GridView({
  items,
  selectedIds,
  publishedIds,
  onToggle,
}: {
  items: FlatItem[];
  selectedIds: Set<string>;
  publishedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {items.map((f) => {
          const sel = selectedIds.has(f.output.id);
          const published = publishedIds.has(f.output.id);
          const thumb = f.output.cdn_thumbnail_url || f.output.thumbnail_url;
          return (
            <button
              key={f.output.id}
              type="button"
              onClick={() => onToggle(f.output.id)}
              className={cn(
                "group relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all bg-zinc-100",
                sel
                  ? "border-violet-500 ring-2 ring-violet-200"
                  : "border-transparent hover:border-zinc-300",
              )}
            >
              <Thumb src={thumb} label={`v${f.output.variant_index + 1}`} />
              {/* 已派单淡叠层 */}
              {published && !sel && (
                <span className="absolute inset-0 bg-white/40" aria-hidden />
              )}

              {/* 顶部任务名 chip */}
              <div className="absolute inset-x-0 top-0 px-1.5 py-1 bg-gradient-to-b from-black/55 to-transparent">
                <div className="text-[10px] text-white truncate font-medium">
                  {f.jobTemplateName}
                </div>
              </div>

              {/* 底部 v 编号 */}
              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono bg-black/65 text-white px-1.5 py-0.5 rounded">
                  v{f.output.variant_index + 1}
                </span>
                {published && !sel && (
                  <span
                    className="text-[10px] bg-emerald-500/85 text-white px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                    title="已派单过"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    已发
                  </span>
                )}
              </div>

              {sel && (
                <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold shadow">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 子视图：按任务分组 ────────────────────────────────────────────────────
function GroupView({
  jobs,
  flatByJob,
  selectedIds,
  publishedIds,
  expanded,
  onToggleExpand,
  onToggleOutput,
  onSelectAllInJob,
  isJobAllSelected,
  highlightedJobId,
  highlightRef,
}: {
  jobs: RenderJob[];
  flatByJob: Map<string, FlatItem[]>;
  selectedIds: Set<string>;
  publishedIds: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleOutput: (id: string) => void;
  onSelectAllInJob: (id: string) => void;
  isJobAllSelected: (id: string) => boolean;
  highlightedJobId?: string;
  highlightRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="space-y-3">
      {jobs.map((j) => {
        const items = flatByJob.get(j.id) ?? [];
        const isExpanded = expanded.has(j.id) || items.length <= 5;
        const inJobSel = items.filter((it) => selectedIds.has(it.output.id)).length;
        const isHighlighted = highlightedJobId === j.id;
        return (
          <div
            key={j.id}
            ref={isHighlighted ? highlightRef : undefined}
            className={cn(
              "rounded-2xl border bg-white p-4 shadow-[var(--shadow-soft)] transition-colors",
              isHighlighted
                ? "border-violet-400 ring-2 ring-violet-100"
                : "border-zinc-200",
            )}
          >
            <header className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-zinc-800 truncate max-w-[280px]">
                    {j.template_name ?? j.template_id}
                  </h3>
                  {isHighlighted && (
                    <span className="text-[10px] font-medium text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">
                      来自混剪
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap font-mono">
                  <span>{shortJobId(j.id)}</span>
                  <span>·</span>
                  <span>{items.length} 条可发</span>
                  {inJobSel > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-violet-600">已选 {inJobSel}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const allSel = isJobAllSelected(j.id);
                  return (
                    <button
                      type="button"
                      onClick={() => onSelectAllInJob(j.id)}
                      className={cn(CTA_SECONDARY, "px-2.5 py-1 text-xs")}
                      aria-pressed={allSel}
                    >
                      {allSel ? "取消全选" : "全选本任务"}
                    </button>
                  );
                })()}
                {items.length > 5 && (
                  <button
                    type="button"
                    onClick={() => onToggleExpand(j.id)}
                    className="text-xs text-zinc-500 hover:text-zinc-800"
                  >
                    {isExpanded ? "收起" : `展开 ${items.length}`}
                  </button>
                )}
              </div>
            </header>

            {isExpanded && (
              <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-2">
                {items.map((f) => {
                  const sel = selectedIds.has(f.output.id);
                  const published = publishedIds.has(f.output.id);
                  const thumb = f.output.cdn_thumbnail_url || f.output.thumbnail_url;
                  return (
                    <button
                      key={f.output.id}
                      type="button"
                      onClick={() => onToggleOutput(f.output.id)}
                      className={cn(
                        "aspect-[9/16] rounded-md overflow-hidden border-2 relative bg-zinc-100 transition-colors",
                        sel
                          ? "border-violet-500 ring-2 ring-violet-200"
                          : "border-transparent hover:border-zinc-300",
                      )}
                    >
                      <Thumb src={thumb} label={`v${f.output.variant_index + 1}`} />
                      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono bg-black/65 text-white px-1.5 py-0.5 rounded">
                          v{f.output.variant_index + 1}
                        </span>
                        {published && !sel && (
                          <span className="text-[10px] bg-emerald-500/85 text-white px-1 rounded">
                            已发
                          </span>
                        )}
                      </div>
                      {sel && (
                        <div className="absolute top-1 right-1 size-5 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold shadow">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 缩略图（带 onError 兜底） ────────────────────────────────────────────
// dev / mock 环境下 thumbnail_url 经常指向不存在的文件，浏览器渲染裸 <img>
// 时会显示「裂图 icon + alt 文字」，体验很差。这里统一 fallback：
//   1) src 为空 / undefined → 直接渲染占位
//   2) 加载失败 onError 触发 → 切到占位
// 占位用 ImageOff 图标 + 极淡的灰底，不抢色。
function Thumb({ src, label }: { src?: string | null; label?: string }) {
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => {
    setErrored(false);
  }, [src]);

  if (!src || errored) {
    return (
      <div className="w-full h-full grid place-items-center bg-zinc-100 text-zinc-400">
        <ImageOff className="h-4 w-4" />
        {label && (
          <span className="absolute bottom-1 left-1 right-1 text-[10px] font-mono text-zinc-500 text-center truncate">
            {label}
          </span>
        )}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover"
      onError={() => setErrored(true)}
    />
  );
}

// ─── 空态 ────────────────────────────────────────────────────────────────
function EmptyState({
  hasAnyJobs,
  showingPublished,
  hasSearch,
}: {
  hasAnyJobs: boolean;
  showingPublished: boolean;
  hasSearch: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <Sparkles className="h-5 w-5 text-zinc-400 mx-auto mb-2" />
      {!hasAnyJobs ? (
        <>
          <p className="text-sm text-zinc-700">还没有可分发的混剪变体</p>
          <p className="text-[12px] text-zinc-500 mt-1">
            到{" "}
            <Link href="/mixcut/templates" className="text-violet-600 underline">
              混剪模板库
            </Link>{" "}
            生成第一批视频，渲染完成后会自动出现在这里。
          </p>
        </>
      ) : hasSearch ? (
        <>
          <p className="text-sm text-zinc-700">没有匹配的视频</p>
          <p className="text-[12px] text-zinc-500 mt-1">换个关键词试试，或清空搜索。</p>
        </>
      ) : !showingPublished ? (
        <>
          <p className="text-sm text-zinc-700">没有未派发的新视频</p>
          <p className="text-[12px] text-zinc-500 mt-1">
            点击「含已发布」可以重新看到所有可发变体。
          </p>
        </>
      ) : (
        <p className="text-sm text-zinc-700">暂无可发布的变体</p>
      )}
    </div>
  );
}

// ─── 视图切换 ────────────────────────────────────────────────────────────
function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
          value === "grid"
            ? "bg-violet-100 text-violet-700"
            : "text-zinc-500 hover:text-zinc-700",
        )}
        title="按变体平铺"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        网格
      </button>
      <button
        type="button"
        onClick={() => onChange("group")}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
          value === "group"
            ? "bg-violet-100 text-violet-700"
            : "text-zinc-500 hover:text-zinc-700",
        )}
        title="按任务分组"
      >
        <Rows className="h-3.5 w-3.5" />
        按任务
      </button>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────
function shortJobId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(0, 6) + "…" + id.slice(-4);
}

function groupFlatByJob(items: FlatItem[]): Map<string, FlatItem[]> {
  const m = new Map<string, FlatItem[]>();
  for (const f of items) {
    const arr = m.get(f.jobId) ?? [];
    arr.push(f);
    m.set(f.jobId, arr);
  }
  return m;
}

function deriveDefaultTitle(items: BatchPublishItem[]): string {
  // 取首条变体的模板名（label 形如 "shortJobId · vN"），简单起见用默认
  if (items.length === 1) return "混剪发布";
  return `混剪批量发布 · ${items.length} 条`;
}

function loadPublished(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(PUBLISHED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function persistPublished(s: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify([...s]));
  } catch {
    /* 静默 */
  }
}
