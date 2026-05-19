"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, RefreshCw, Sparkles, Search, X } from "lucide-react";
import { MixcutApi } from "@/api";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { BatchPublishDrawer, type BatchPublishItem } from "@/components/mixcut-zone/BatchPublishDrawer";
import { cn, relativeTime } from "@/components/mixcut-zone/lib/utils";

/**
 * 混剪发布工作台 client。
 *
 * 行为：
 *  1) 拉所有 mixcut 任务，按 created_at 倒序
 *  2) 仅保留 status=success 且至少一个 output 有 cdn_url 的任务
 *  3) 默认全收起；用户点击 "展开" 看变体
 *  4) 跨任务多选；点 "继续发布" 打开 BatchPublishDrawer
 *  5) Drawer 接 items[] 模式，不需要单个 job 上下文
 */
export function PublishWorkbenchClient() {
  const [jobs, setJobs] = useState<RenderJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = async () => {
    try {
      const list = await MixcutApi.listJobs();
      setJobs(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    load();
  }, []);

  // 过滤：仅 success + 有可发布 cdn_url 的 outputs
  const eligibleJobs = useMemo(() => {
    if (!jobs) return [];
    const ql = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (j.status !== "success") return false;
      const outs = (j.outputs ?? []) as (RenderOutput & { cdn_url?: string })[];
      const hasCdn = outs.some((o) => Boolean(o.cdn_url));
      if (!hasCdn) return false;
      if (!ql) return true;
      return (j.template_name ?? "").toLowerCase().includes(ql) || j.id.toLowerCase().includes(ql);
    });
  }, [jobs, search]);

  // 所有 outputs 平铺成 {jobId, output, label}，便于 selection
  const allFlat = useMemo(() => {
    const out: { jobId: string; templateName: string; output: RenderOutput & { cdn_url?: string; cdn_thumbnail_url?: string } }[] = [];
    for (const j of eligibleJobs) {
      const outs = (j.outputs ?? []) as (RenderOutput & { cdn_url?: string; cdn_thumbnail_url?: string })[];
      for (const o of outs) {
        if (o.cdn_url) out.push({ jobId: j.id, templateName: j.template_name ?? j.template_id, output: o });
      }
    }
    return out;
  }, [eligibleJobs]);

  const selectedItems: BatchPublishItem[] = useMemo(() => {
    return allFlat
      .filter((f) => selectedIds.has(f.output.id))
      .map((f) => ({
        output_id: f.output.id,
        label: `${shortJobId(f.jobId)} · v${f.output.variant_index + 1}`,
        cdn_url: f.output.cdn_url!,
        thumbnail_url: f.output.cdn_thumbnail_url || f.output.thumbnail_url || undefined,
      }));
  }, [allFlat, selectedIds]);

  const toggleOutput = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleExpand = (jobId: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };
  const selectAllInJob = (job: RenderJob) => {
    const ids = (job.outputs ?? [])
      .filter((o) => Boolean((o as RenderOutput & { cdn_url?: string }).cdn_url))
      .map((o) => o.id);
    setSelectedIds((cur) => {
      const next = new Set(cur);
      for (const id of ids) next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1400px] mx-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/mixcut">
            <ArrowLeft className="size-4" /> 返回混剪首页
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="size-4" /> 刷新
        </Button>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Send className="size-5 text-violet-500" />
          混剪发布工作台
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          跨任务挑选混剪变体 → 多平台批量发布。仅显示已上传到 CDN 的变体。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4 min-w-0">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模板名或任务 ID…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background"
            />
          </div>

          {jobs === null && !error && (
            <div className="text-sm text-muted-foreground py-12 text-center">加载中…</div>
          )}
          {error && (
            <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-md p-4">
              {error}
            </div>
          )}
          {jobs !== null && eligibleJobs.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <Sparkles className="size-6 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  暂无可发布的混剪任务。先去{" "}
                  <Link href="/mixcut/templates" className="underline">
                    模板库
                  </Link>{" "}
                  挑模板生成。
                </p>
              </CardContent>
            </Card>
          )}

          {eligibleJobs.map((j) => {
            const outs = (j.outputs ?? []) as (RenderOutput & { cdn_url?: string; cdn_thumbnail_url?: string })[];
            const eligibleOuts = outs.filter((o) => Boolean(o.cdn_url));
            const isExpanded = expanded.has(j.id);
            const inJobSel = eligibleOuts.filter((o) => selectedIds.has(o.id)).length;
            return (
              <Card key={j.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{j.template_name ?? j.template_id}</CardTitle>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{j.id}</span>
                        <span>·</span>
                        <span>{relativeTime(j.created_at)}</span>
                        <span>·</span>
                        <span>{eligibleOuts.length} / {outs.length} 可发</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inJobSel > 0 && (
                        <Badge variant="muted" className="text-[10px]">
                          已选 {inJobSel}
                        </Badge>
                      )}
                      <Button variant="outline" size="sm" onClick={() => selectAllInJob(j)}>
                        全选本任务
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(j.id)}>
                        {isExpanded ? "收起" : "展开变体"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                      {eligibleOuts.map((o) => {
                        const sel = selectedIds.has(o.id);
                        const thumb = o.cdn_thumbnail_url || o.thumbnail_url;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => toggleOutput(o.id)}
                            className={cn(
                              "aspect-[9/16] rounded-md border-2 overflow-hidden relative bg-secondary/50 transition-colors",
                              sel
                                ? "border-violet-500 ring-2 ring-violet-500/30"
                                : "border-transparent hover:border-border"
                            )}
                          >
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt={`v${o.variant_index + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                v{o.variant_index + 1}
                              </div>
                            )}
                            <div className="absolute bottom-1 left-1 right-1 text-[10px] font-mono bg-black/60 text-white px-1 rounded">
                              v{o.variant_index + 1}
                            </div>
                            {sel && (
                              <div className="absolute top-1 right-1 size-5 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">
                                ✓
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Right rail: selection summary + 继续 */}
        <aside className="lg:sticky lg:top-20 self-start space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">已选 {selectedIds.size} 个变体</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                选好后点「继续发布」，下一步配置文案 / 账号 / 定时。
              </p>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-rose-500"
                >
                  <X className="size-3" /> 清空选择
                </button>
              )}
              <Button
                variant="gradient"
                className="w-full"
                disabled={selectedIds.size === 0}
                onClick={() => setDrawerOpen(true)}
              >
                <Send className="size-4" /> 继续发布
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
              <p>· 仅显示已上传到 CDN 的变体；未上传需在任务详情页等渲染完毕。</p>
              <p>· 同一变体可被发布到多个账号；每条 (变体 × 账号) 产生一条 PublishJob。</p>
              <p>· 支持定时发布，最小调度间隔约 60 秒。</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <BatchPublishDrawer
        items={selectedItems}
        defaultTitle="混剪批量发布"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPublished={() => {
          // 派单成功后清空选择，但留 drawer 让用户看结果
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}

function shortJobId(id: string): string {
  if (id.length <= 10) return id;
  return id.slice(0, 4) + "…" + id.slice(-4);
}
