"use client";

// 混剪成片（只读）——聚合到一级「视频库」的来源 Tab 之一。
// 拍平 MixcutApi.listJobs() 里所有 status=success 任务的 outputs，按生成时间倒序。
// 只读浏览：保留「第 N 条」「已分发 ×N」徽标；不带删除（软删入口本版下线）。
// 删除 / 重跑等管理动作仍在混剪专区任务详情页（/mixcut/jobs/{id}）。

import { useEffect, useState } from "react";
import { Search, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Input } from "@/components/mixcut-zone/ui/input";
import { MixcutApi } from "@/api";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import { relativeTime } from "@/components/mixcut-zone/lib/utils";

type EligibleOutput = RenderOutput & {
  cdn_url?: string;
  cdn_thumbnail_url?: string;
  publish_count?: number;
};

interface VideoItem {
  jobId: string;
  templateName: string;
  output: EligibleOutput;
}

export function MixcutOutputsTab() {
  const [jobs, setJobs] = useState<RenderJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    MixcutApi.listJobs()
      .then((list) => {
        if (cancelled) return;
        setJobs(list ?? []);
        setError(null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items: VideoItem[] = (() => {
    if (!jobs) return [];
    const result: VideoItem[] = [];
    for (const j of jobs) {
      if (j.status !== "success") continue;
      const outs = (j.outputs ?? []) as EligibleOutput[];
      for (const o of outs) {
        if (!o.file_url && !o.cdn_url) continue;
        result.push({
          jobId: j.id,
          templateName: j.template_name ?? j.template_id,
          output: o,
        });
      }
    }
    result.sort((a, b) => {
      const ta = new Date(a.output.created_at).getTime();
      const tb = new Date(b.output.created_at).getTime();
      return tb - ta;
    });
    return result;
  })();

  const filtered = items.filter((it) => {
    const ql = search.trim().toLowerCase();
    if (!ql) return true;
    return (
      it.templateName.toLowerCase().includes(ql) ||
      it.jobId.toLowerCase().includes(ql)
    );
  });

  if (jobs === null && !error) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-violet-500" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          共 <span className="font-mono text-foreground">{filtered.length}</span> 条混剪成片；在混剪专区任务详情可下载 / 分发 / 删除
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模板 / 任务名…"
            className="pl-9 h-9"
          />
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/[0.04]">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            <Sparkles className="size-6 mx-auto mb-2 text-zinc-400" />
            还没有混剪成片。先去混剪专区挑一个模板，生成一批吧。
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((it) => (
            <VideoCard key={it.output.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoCard({ item }: { item: VideoItem }) {
  const thumb = item.output.cdn_thumbnail_url || item.output.thumbnail_url;
  const publishCount = item.output.publish_count ?? 0;
  return (
    <Card className="overflow-hidden group hover:border-foreground/30 transition-colors">
      <div className="relative aspect-[9/16] bg-secondary/40">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
            无预览
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="text-[10px] font-mono bg-black/65 text-white px-1.5 py-0.5 rounded">
            第 {item.output.variant_index + 1} 条
          </span>
        </div>
        {publishCount > 0 && (
          <div className="absolute top-1.5 right-1.5">
            <span className="text-[10px] bg-emerald-500/85 text-white px-1.5 py-0.5 rounded">
              已分发 ×{publishCount}
            </span>
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-1.5">
        <div className="text-sm font-medium line-clamp-1" title={item.templateName}>
          {item.templateName}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {relativeTime(item.output.created_at)}
        </div>
      </CardContent>
    </Card>
  );
}
