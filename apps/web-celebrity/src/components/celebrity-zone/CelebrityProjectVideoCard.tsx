"use client";

import * as React from "react";
import { Eye, Loader2, Trash2 } from "lucide-react";
import type { CelebrityProjectVideo } from "@ai-star-eco/types/celebrity-zone";
import { ENGINE_META, VIDEO_STATUS_BADGE } from "@/constants/celebrity-zone-ui";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  video: CelebrityProjectVideo;
  /** 是否显示项目名（视频库 Tab 用） */
  showProject?: boolean;
  /** 点击卡片打开大图浏览（lightbox）。 */
  onOpen?: (video: CelebrityProjectVideo) => void;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: (video: CelebrityProjectVideo) => void;
  compact?: boolean;
}

export function CelebrityProjectVideoCard({
  video,
  showProject,
  onOpen,
  canDelete = false,
  deleting = false,
  onDelete,
  compact = false,
}: Props) {
  const status = VIDEO_STATUS_BADGE[video.status];
  const engineColor = ENGINE_META[video.engine].color;

  return (
    <div
      className={cn(
        "flex flex-col border border-zinc-200 bg-zinc-50 transition hover:border-violet-300 hover:bg-zinc-100",
        compact ? "gap-1.5 rounded-lg p-1.5" : "gap-2 rounded-xl p-2.5",
      )}
    >
      <div className="relative">
        <CelebrityVideoPlayer
          src={video.videoUrl}
          poster={video.thumb}
          durationSec={video.durationSec}
          aspect={compact ? "4/5" : "9/16"}
          onOpen={onOpen ? () => onOpen(video) : undefined}
          className={compact ? "rounded-md" : undefined}
          badge={
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 font-medium backdrop-blur",
                compact ? "text-[9px]" : "text-[10px]",
                status.className,
              )}
            >
              {video.status}
            </span>
          }
        />
        {canDelete && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(video);
            }}
            disabled={deleting}
            title="删除视频"
            className={cn(
              "mobile-icon-target absolute z-20 inline-flex items-center justify-center rounded-md bg-black/65 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60",
              compact ? "bottom-1 left-1 h-7 w-7" : "bottom-1.5 left-1.5 h-8 w-8",
            )}
          >
            {deleting ? (
              <Loader2 className={cn("animate-spin", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
            ) : (
              <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            )}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpen?.(video)}
        disabled={!onOpen}
        className="px-0.5 text-left disabled:cursor-default"
      >
        <div className={cn("line-clamp-1 font-medium text-zinc-700", compact ? "text-[11px]" : "text-xs")}>
          {video.productName}
        </div>
        {showProject && (
          <div className="mt-0.5 line-clamp-1 text-[10px] text-zinc-400">
            {video.projectName} · {video.starName}
          </div>
        )}
        <div className="mt-1 flex items-center justify-between">
          <span
            className="rounded border px-1 text-[9px]"
            style={{
              borderColor: `${engineColor}55`,
              color: engineColor,
              background: `${engineColor}14`,
            }}
          >
            {video.engine}
          </span>
          {video.plays && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400">
              <Eye className="h-3 w-3" /> {video.plays}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
