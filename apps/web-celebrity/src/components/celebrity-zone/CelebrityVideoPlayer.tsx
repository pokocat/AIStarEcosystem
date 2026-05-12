"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  src: string;
  poster?: string;
  /** 时长秒数，仅展示用（缩略模式右下角） */
  durationSec?: number;
  /** 右上角徽章（项目状态、热门标签等） */
  badge?: React.ReactNode;
  /**
   * 缩略模式：默认 true。
   * 渲染海报图 + 中央播放按钮，点击后切到带 controls 的 video 元素，
   * 防止网格一次加载几十路视频流。设为 false 则直接渲染 video（详情大图位）。
   */
  thumbnailMode?: boolean;
  className?: string;
  /** 视频比例（默认 9:16 portrait） */
  aspect?: "9/16" | "16/9";
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * 列表 / 详情通用视频播放器：
 * - thumbnailMode=true（默认）→ 海报 + 中心 ▶︎；点击后载入并播放，附原生 controls。
 * - thumbnailMode=false → 直接渲染 video，preload="metadata"。
 */
export function CelebrityVideoPlayer({
  src,
  poster,
  durationSec,
  badge,
  thumbnailMode = true,
  className,
  aspect = "9/16",
}: Props) {
  const [active, setActive] = React.useState(!thumbnailMode);
  const aspectClass = aspect === "16/9" ? "aspect-video" : "aspect-[9/16]";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-white/8 bg-black",
        aspectClass,
        className,
      )}
    >
      {active ? (
        <video
          src={src}
          poster={poster}
          controls
          autoPlay={thumbnailMode}
          preload="metadata"
          playsInline
          className="h-full w-full object-cover"
        >
          您的浏览器不支持视频播放。
        </video>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActive(true);
          }}
          className="block h-full w-full"
          aria-label="播放视频"
        >
          {poster ? (
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-zinc-900 to-zinc-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition group-hover:bg-black/80 group-hover:scale-110">
            <Play className="ml-0.5 h-5 w-5" />
          </span>
          {durationSec ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1 py-0.5 text-[9px] font-medium tabular-nums text-white/85 backdrop-blur">
              {pad2(Math.floor(durationSec / 60))}:{pad2(durationSec % 60)}
            </span>
          ) : null}
        </button>
      )}
      {badge ? <div className="absolute right-1.5 top-1.5 z-10">{badge}</div> : null}
    </div>
  );
}
