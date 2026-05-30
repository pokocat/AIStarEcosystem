"use client";

// 脚本视频（只读聚合）——一级「视频库」的来源 Tab 之一。
// 拉 MaterialOpsApi.listVideos() 汇总素材运营脚本派生出来的带货视频，纯浏览。
// 生产动作（派生 / 详情 / AI 提卖点 / 删除）仍在「素材运营 → 商品素材库」(/material/assets)；
// 这里点击卡片即跳过去操作。
//
// 渲染中（status=rendering）存在时 3s 轻量轮询刷新进度。

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, PlayCircle, Loader2, TriangleAlert, Search, Film } from "lucide-react";
import type { MaterialVideo } from "@/components/material-ops/types";
import { MaterialOpsApi } from "@/api";
import { cn } from "@ai-star-eco/ui/ui/utils";

const STATUS_BADGE: Record<MaterialVideo["status"], { label: string; className: string }> = {
  ready: { label: "已生成", className: "bg-emerald-500/90 text-white" },
  rendering: { label: "生成中", className: "bg-sky-500/90 text-white" },
  queued: { label: "排队中", className: "bg-amber-500/90 text-white" },
  failed: { label: "生成失败", className: "bg-red-500/90 text-white" },
};

export function ScriptVideosTab() {
  const router = useRouter();
  const [videos, setVideos] = React.useState<MaterialVideo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(() => {
    return MaterialOpsApi.listVideos()
      .then((v) => {
        setVideos(v);
        setError(null);
      })
      .catch((e: any) => setError(e?.message ?? "加载失败"));
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // 渲染中任务推进：mock 模式由 advanceRenderTasks 模拟，live 模式靠 load 重拉真实进度。
  const hasRendering = !!videos?.some((v) => v.status === "rendering");
  React.useEffect(() => {
    if (!hasRendering) return;
    const t = setInterval(() => {
      MaterialOpsApi.advanceRenderTasks().then(() => load());
    }, 3000);
    return () => clearInterval(t);
  }, [hasRendering, load]);

  const goManage = (video?: MaterialVideo) => {
    const pid = video?.product_id;
    router.push(pid ? `/material/assets?product=${encodeURIComponent(pid)}` : "/material/assets");
  };

  const filtered = (videos ?? []).filter((v) => {
    const q = query.trim();
    return !q || v.name.includes(q);
  });

  if (videos === null && !error) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
        <Loader2 className="mx-auto mb-2 size-6 animate-spin text-violet-500" />
        加载中…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10">
          <Film className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-zinc-800">
            脚本视频 · {videos?.length ?? 0} 条
          </div>
          <div className="text-xs text-zinc-500">
            素材运营脚本派生的带货视频，此处汇总浏览。派生 / 详情 / 提取卖点等请前往
            <button
              type="button"
              onClick={() => goManage()}
              className="mx-1 inline-flex items-center gap-0.5 text-violet-600 underline-offset-2 hover:underline"
            >
              商品素材库 <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索视频名…"
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-800 outline-none focus:border-violet-400"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.04] px-4 py-3 text-sm text-red-500">
          <TriangleAlert className="size-4 shrink-0" /> {error}
        </div>
      )}

      {filtered.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          还没有脚本派生的带货视频。去
          <button type="button" onClick={() => goManage()} className="mx-1 text-violet-600 hover:underline">
            商品素材库
          </button>
          挑个脚本生成一批吧。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {filtered.map((v) => (
            <ScriptVideoCard key={v.id} video={v} onClick={() => goManage(v)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptVideoCard({ video, onClick }: { video: MaterialVideo; onClick: () => void }) {
  const badge = STATUS_BADGE[video.status];
  const isRendering = video.status === "rendering";
  const isFailed = video.status === "failed";
  return (
    <button
      type="button"
      onClick={onClick}
      title="前往商品素材库查看 / 操作"
      className="group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-left transition hover:border-violet-300 hover:bg-zinc-100"
    >
      <div
        className="relative aspect-[9/16] overflow-hidden rounded-lg"
        style={{
          background: video.cover_color
            ? `linear-gradient(135deg, ${video.cover_color}, ${video.cover_color}55)`
            : "#18181b",
        }}
      >
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}

        {/* 状态徽标 */}
        <span
          className={cn(
            "absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-medium backdrop-blur",
            badge.className,
          )}
        >
          {isRendering ? `生成中 ${video.progress_pct ?? 0}%` : badge.label}
        </span>

        {/* 中央图标 */}
        {isFailed ? (
          <TriangleAlert className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white/90" />
        ) : isRendering ? (
          <Loader2 className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/90" />
        ) : (
          <PlayCircle className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-white/85 opacity-0 transition group-hover:opacity-100" />
        )}

        {/* 时长 */}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1 text-[9px] font-mono text-white">
          {video.duration_sec}s
        </span>
      </div>
      <div className="px-0.5">
        <div className="line-clamp-2 min-h-[2.4em] text-xs font-medium text-zinc-700">{video.name}</div>
        {video.metrics ? (
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
            <span>{video.metrics.plays}</span>
            <span className="text-emerald-600">· {video.metrics.ctr_pct}%</span>
            <span className="text-amber-600">· {video.metrics.gmv}</span>
          </div>
        ) : (
          <div className="mt-1 font-mono text-[10px] text-zinc-400">
            {video.generated_at ? `生成于 ${video.generated_at.slice(5, 10)}` : video.created_at.slice(5, 10)}
          </div>
        )}
      </div>
    </button>
  );
}
