"use client";

import * as React from "react";
import { Eye } from "lucide-react";
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
}

export function CelebrityProjectVideoCard({ video, showProject, onOpen }: Props) {
  const status = VIDEO_STATUS_BADGE[video.status];
  const engineColor = ENGINE_META[video.engine].color;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 transition hover:border-violet-300 hover:bg-zinc-100">
      <CelebrityVideoPlayer
        src={video.videoUrl}
        poster={video.thumb}
        durationSec={video.durationSec}
        aspect="9/16"
        onOpen={onOpen ? () => onOpen(video) : undefined}
        badge={
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur",
              status.className,
            )}
          >
            {video.status}
          </span>
        }
      />
      <button
        type="button"
        onClick={() => onOpen?.(video)}
        disabled={!onOpen}
        className="px-0.5 text-left disabled:cursor-default"
      >
        <div className="line-clamp-1 text-xs font-medium text-zinc-700">
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
