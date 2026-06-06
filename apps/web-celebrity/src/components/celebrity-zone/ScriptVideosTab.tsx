"use client";

// 脚本视频（只读聚合）——一级「视频库」的来源 Tab 之一。
// 拉 MaterialOpsApi.listVideos() 平铺汇总素材运营脚本派生出来的全部带货视频。
// 可见 + 可预览 + 可就地播放：
//   - 封面：thumbnail_url → 无则用 video_url 首帧 → 再无则 cover_color 渐变。
//   - 点击有 video_url 的卡 → 弹 lightbox 就地播放；无 video_url → 跳商品素材库。
// 生产动作（派生 / 详情 / AI 提卖点 / 删除）仍在「素材运营 → 商品素材库」(/material/assets)，
// lightbox 内提供「去商品素材库」入口。
//
// 渲染中（status=rendering）存在时 3s 轻量轮询刷新进度。

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, PlayCircle, Loader2, TriangleAlert, Search, Film, Trash2 } from "lucide-react";
import type { MaterialVideo } from "@/components/material-ops/types";
import { MaterialOpsApi } from "@/api";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { useAuth } from "@ai-star-eco/api-client";
import { useConfirm } from "@/components/common/confirm-dialog";
import { VIDEO_ASSET_GRID_CLASS, VIDEO_ASSET_TOOLBAR_CLASS } from "@/components/common/video-library-density";
import { canUseOperatorTools } from "@/lib/operator-role";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";

const STATUS_BADGE: Record<MaterialVideo["status"], { label: string; className: string }> = {
  ready: { label: "已生成", className: "bg-emerald-500/90 text-white" },
  rendering: { label: "生成中", className: "bg-sky-500/90 text-white" },
  queued: { label: "排队中", className: "bg-amber-500/90 text-white" },
  failed: { label: "生成失败", className: "bg-red-500/90 text-white" },
};

/** 无海报但有视频源时，用视频首帧当封面（muted + preload=metadata + 轻 seek）。 */
function PosterFromVideo({ src }: { src: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={() => {
        const el = ref.current;
        if (!el || !Number.isFinite(el.duration)) return;
        try {
          el.currentTime = Math.min(0.75, Math.max(0, el.duration - 0.1));
        } catch {
          /* 某些浏览器拒绝过早 seek，保留首帧即可。 */
        }
      }}
      className="h-full w-full object-cover"
    />
  );
}

export function ScriptVideosTab() {
  const router = useRouter();
  const { user } = useAuth();
  const canDeleteVideos = canUseOperatorTools(user?.operatorRole);
  const { confirm, ConfirmHost } = useConfirm();
  const [videos, setVideos] = React.useState<MaterialVideo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [playing, setPlaying] = React.useState<MaterialVideo | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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

  // 点击卡片：有可播放源 → 就地开 lightbox；否则（渲染中 / 无源）→ 跳商品素材库。
  const handleCardClick = (video: MaterialVideo) => {
    if (video.status === "ready" && video.video_url) setPlaying(video);
    else goManage(video);
  };

  const handleDelete = async (video: MaterialVideo) => {
    if (!canDeleteVideos || deletingId) return;
    const ok = await confirm({
      title: "删除脚本视频?",
      description: (
        <span>
          删除后会立即从视频库隐藏，后台保留软删记录，后续可做恢复或审计。
        </span>
      ),
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(video.id);
    setError(null);
    try {
      await MaterialOpsApi.deleteVideo(video.id);
      setVideos((prev) => prev?.filter((v) => v.id !== video.id) ?? prev);
      if (playing?.id === video.id) setPlaying(null);
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    } finally {
      setDeletingId(null);
    }
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
    <div className="flex flex-col gap-3">
      <div className={cn(VIDEO_ASSET_TOOLBAR_CLASS, "flex flex-wrap items-center gap-2")}>
        <div className="inline-flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/10">
            <Film className="h-4 w-4 text-violet-600" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-800">
              脚本视频 · {filtered.length}/{videos?.length ?? 0}
            </div>
            <div className="truncate text-[11px] text-zinc-500">
              点击预览播放，派生 / 详情 / 提取卖点前往
              <button
                type="button"
                onClick={() => goManage()}
                className="ml-1 inline-flex items-center gap-0.5 text-violet-600 underline-offset-2 hover:underline"
              >
                商品素材库 <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索视频名…"
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-xs text-zinc-800 outline-none focus:border-violet-400"
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
        <div className={VIDEO_ASSET_GRID_CLASS}>
          {filtered.map((v) => (
            <ScriptVideoCard
              key={v.id}
              video={v}
              onClick={() => handleCardClick(v)}
              canDelete={canDeleteVideos}
              deleting={deletingId === v.id}
              onDelete={() => handleDelete(v)}
            />
          ))}
        </div>
      )}

      {/* 就地播放 lightbox */}
      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-sm overflow-hidden border-zinc-800 bg-zinc-950 p-0">
          {playing && (
            <>
              <DialogHeader className="px-4 pb-2 pt-4">
                <DialogTitle className="line-clamp-1 text-sm font-medium text-white">
                  {playing.name}
                </DialogTitle>
              </DialogHeader>
              <div className="px-4">
                <video
                  src={playing.video_url ?? undefined}
                  poster={playing.thumbnail_url ?? undefined}
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
                {playing.metrics ? (
                  <span className="font-mono">
                    {playing.metrics.plays} · {playing.metrics.ctr_pct}% · {playing.metrics.gmv}
                  </span>
                ) : (
                  <span className="font-mono">{playing.duration_sec}s</span>
                )}
                <button
                  type="button"
                  onClick={() => goManage(playing)}
                  className="ml-auto inline-flex items-center gap-0.5 text-violet-400 underline-offset-2 hover:underline"
                >
                  去商品素材库 <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmHost />
    </div>
  );
}

function ScriptVideoCard({
  video,
  onClick,
  canDelete,
  deleting,
  onDelete,
}: {
  video: MaterialVideo;
  onClick: () => void;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const badge = STATUS_BADGE[video.status];
  const isRendering = video.status === "rendering";
  const isFailed = video.status === "failed";
  const canPlay = video.status === "ready" && !!video.video_url;
  return (
    <div className="group flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 text-left transition hover:border-violet-300 hover:bg-zinc-100">
      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          title={canPlay ? "点击预览播放" : "前往商品素材库查看 / 操作"}
          className="relative block aspect-[4/5] w-full overflow-hidden rounded-md text-left"
          style={{
            background: video.cover_color
              ? `linear-gradient(135deg, ${video.cover_color}, ${video.cover_color}55)`
              : "#18181b",
          }}
        >
          {/* 封面：缩略图 → 视频首帧 → 渐变兜底。渲染中 / 失败不取视频帧。 */}
          {video.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : !isRendering && !isFailed && video.video_url ? (
            <PosterFromVideo src={video.video_url} />
          ) : null}

          {/* 状态徽标 */}
          <span
            className={cn(
              "absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-medium backdrop-blur",
              badge.className,
            )}
          >
            {isRendering ? `生成中 ${video.progress_pct ?? 0}%` : badge.label}
          </span>

          {/* 中央图标 */}
          {isFailed ? (
            <TriangleAlert className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-white/90" />
          ) : isRendering ? (
            <Loader2 className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/90" />
          ) : canPlay ? (
            <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/55 text-zinc-900 backdrop-blur-sm transition group-hover:bg-white/80 group-hover:scale-110">
              <PlayCircle className="size-5" />
            </span>
          ) : (
            <PlayCircle className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white/85 opacity-0 transition group-hover:opacity-100" />
          )}

          {/* 时长 */}
          <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[9px] font-mono text-white">
            {video.duration_sec}s
          </span>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            title="删除视频"
            className="absolute bottom-1 left-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/65 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        )}
      </div>
      <div className="px-0.5">
        <div className="line-clamp-1 text-[11px] font-medium text-zinc-700">{video.name}</div>
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
    </div>
  );
}
