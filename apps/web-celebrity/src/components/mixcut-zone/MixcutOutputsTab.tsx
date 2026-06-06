"use client";

// 混剪成片 —— 聚合到一级「视频库」的来源 Tab 之一。
// 拍平 MixcutApi.listJobs() 里所有 status=success 任务的 outputs，按生成时间倒序。
// 保留「第 N 条」「已分发 ×N」徽标；删除为软删，后端 30 天后再物理清理。

import { useEffect, useState } from "react";
import { Search, AlertCircle, Loader2, Sparkles, Trash2, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Input } from "@/components/mixcut-zone/ui/input";
import { MixcutApi } from "@/api";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import { relativeTime } from "@/components/mixcut-zone/lib/utils";
import { useConfirm } from "@/components/common/confirm-dialog";
import { VIDEO_ASSET_GRID_CLASS, VIDEO_ASSET_TOOLBAR_CLASS } from "@/components/common/video-library-density";
import { useAuth } from "@ai-star-eco/api-client";
import { canUseOperatorTools } from "@/lib/operator-role";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";

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
  const { user } = useAuth();
  const canDeleteVideos = canUseOperatorTools(user?.operatorRole);
  const [jobs, setJobs] = useState<RenderJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<VideoItem | null>(null);
  const { confirm, ConfirmHost } = useConfirm();

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

  const handleDelete = async (item: VideoItem) => {
    if (!canDeleteVideos) return;
    const ok = await confirm({
      title: "删除混剪成片?",
      description: (
        <span>
          删除后会立即从视频库隐藏，后端保留 30 天后再物理清理。
        </span>
      ),
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(item.output.id);
    setError(null);
    try {
      const deleted = await MixcutApi.deleteOutput(item.output.id);
      if (!deleted) {
        setError("删除失败：视频不存在或没有权限");
        return;
      }
      setJobs((prev) =>
        prev?.map((job) =>
          job.id !== item.jobId
            ? job
            : {
                ...job,
                outputs: (job.outputs ?? []).filter((o) => o.id !== item.output.id),
              },
        ) ?? prev,
      );
      if (selected?.output.id === item.output.id) setSelected(null);
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

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
    <div className="space-y-3">
      <div className={`${VIDEO_ASSET_TOOLBAR_CLASS} flex flex-wrap items-center gap-2`}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-zinc-800">
            混剪成片 · {filtered.length}/{items.length}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            点击预览，完整发布操作在分发中心；{canDeleteVideos ? "可软删" : "只读浏览"}
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模板 / 任务名…"
            className="h-8 pl-9 text-xs"
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
        <div className={VIDEO_ASSET_GRID_CLASS}>
          {filtered.map((it) => (
            <VideoCard
              key={it.output.id}
              item={it}
              deleting={deletingId === it.output.id}
              canDelete={canDeleteVideos}
              onOpen={setSelected}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm overflow-hidden border-zinc-800 bg-zinc-950 p-0">
          {selected && (
            <>
              <DialogHeader className="px-4 pb-2 pt-4">
                <DialogTitle className="line-clamp-1 text-sm font-medium text-white">
                  {selected.templateName} · 第 {selected.output.variant_index + 1} 条
                </DialogTitle>
              </DialogHeader>
              <div className="px-4">
                <video
                  src={selected.output.cdn_url || selected.output.file_url}
                  poster={selected.output.cdn_thumbnail_url || selected.output.thumbnail_url}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="mx-auto aspect-[9/16] w-[300px] max-w-full rounded-lg bg-black object-cover"
                >
                  您的浏览器不支持视频播放。
                </video>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[11px] text-zinc-400">
                <span>{relativeTime(selected.output.created_at)}</span>
                <span className="font-mono">job {selected.jobId}</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmHost />
    </div>
  );
}

function VideoCard({
  item,
  deleting,
  canDelete,
  onOpen,
  onDelete,
}: {
  item: VideoItem;
  deleting: boolean;
  canDelete: boolean;
  onOpen: (item: VideoItem) => void;
  onDelete: (item: VideoItem) => void;
}) {
  const thumb = item.output.cdn_thumbnail_url || item.output.thumbnail_url;
  const publishCount = item.output.publish_count ?? 0;
  return (
    <Card className="group overflow-hidden rounded-lg transition-colors hover:border-foreground/30">
      <div className="relative aspect-[4/5] bg-secondary/40">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="block h-full w-full overflow-hidden text-left"
          title="预览混剪成片"
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
              无预览
            </div>
          )}
          <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/55 text-zinc-900 backdrop-blur-sm transition group-hover:bg-white/80 group-hover:scale-110">
            <PlayCircle className="size-5" />
          </span>
        </button>
        <div className="absolute top-1 left-1">
          <span className="text-[10px] font-mono bg-black/65 text-white px-1.5 py-0.5 rounded">
            第 {item.output.variant_index + 1} 条
          </span>
        </div>
        {publishCount > 0 && (
          <div className="absolute top-1 right-1">
            <span className="text-[10px] bg-emerald-500/85 text-white px-1.5 py-0.5 rounded">
              已分发 ×{publishCount}
            </span>
          </div>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={deleting}
            title="删除视频"
            className="absolute bottom-1 left-1 inline-flex size-7 items-center justify-center rounded-md bg-black/65 text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        )}
      </div>
      <CardContent className="space-y-1 p-2">
        <div className="line-clamp-1 text-[11px] font-medium" title={item.templateName}>
          {item.templateName}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {relativeTime(item.output.created_at)}
        </div>
      </CardContent>
    </Card>
  );
}
